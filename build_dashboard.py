#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
申论素材看板数据构建器
读取工作区内的「每日素材」与「主题素材库」md 文件，解析为结构化数据 data.js
供 dashboard/index.html 看板展示。每日由定时任务调用本脚本实现自动更新。
"""
import os, re, json, glob
from datetime import datetime
from collections import OrderedDict

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAILY_DIR = os.path.join(WORKSPACE, "申论素材")
LIB_DIR   = os.path.join(WORKSPACE, "申论素材库", "素材")
OUT_PATH  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.js")

# 六大主题（用于识别主题库中的常规主题；非常规文件当作特殊卡展示）
MAIN_THEMES = ["乡村振兴", "科技创新", "民生保障", "基层治理", "生态文明", "数字经济"]

CAT_ALIAS = {
    "金句": "金句", "政策表述": "政策表述", "政策": "政策表述",
    "案例": "案例", "数据": "数据",
}

def parse_date(s):
    """从字符串中识别 YYYY-MM-DD 或 YYYYMMDD 日期"""
    m = re.search(r'(20\d{2})[-_]?(\d{1,2})[-_]?(\d{1,2})', s)
    if m:
        y, mo, d = m.group(1), m.group(2).zfill(2), m.group(3).zfill(2)
        try:
            return f"{y}-{mo}-{d}"
        except Exception:
            return None
    return None

def norm_item(line):
    """去掉 bullet/p编号前缀，标准化条目文本"""
    line = line.strip()
    if not line:
        return None
    # 去数字编号： "12." "1、" "①"
    line = re.sub(r'^\d+[\.、]\s*', '', line)
    line = re.sub(r'^\s*[-*+]\s*', '', line)
    line = line.strip()
    if not line or line in ("---",):
        return None
    return line

def parse_theme_file(path):
    """解析主题素材库文件（乡村振兴.md 等）
    返回: {name, file, batches: [{date_or_label, categories:{类别:[items]}}], updated}
    """
    name = os.path.splitext(os.path.basename(path))[0]
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    batch_label = "历史积累"      # 初始批
    category = None
    batches = OrderedDict()
    batches[batch_label] = {"date": None, "title": "历史积累", "categories": OrderedDict()}
    updated = None
    last_date = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        # 主标题 # 主题名
        if line.startswith("# ") and not line.startswith("## "):
            continue
        # 新增批次标题 ### 2026-08-19 新增（标题）
        if line.startswith("### "):
            t = line[4:].strip()
            m = re.match(r'^(20\d{2}[-_]?\d{1,2}[-_]?\d{1,2})', t)
            d = parse_date(t)
            title = re.sub(r'^.*?新增（(.*)）.*$', r'\1', t)
            if title == t:
                title = t
            label = d if d else t
            if d:
                last_date = d
            batch_label = label + " " + title
            batches.setdefault(batch_label, {"date": d, "title": title, "categories": OrderedDict()})
            category = None
            continue
        # 类别标题 ## 金句 / ## 政策表述 ...
        if line.startswith("## "):
            key = line[3:].strip()
            cat = CAT_ALIAS.get(key)
            if cat:
                category = cat
                b = batches[batch_label]
                b["categories"].setdefault(category, [])
            continue
        # 条目
        if line.startswith("-") or line.startswith("*") or re.match(r'^\d+[\.、]', line):
            if category and batch_label in batches:
                item = norm_item(line)
                if item:
                    batches[batch_label]["categories"][category].append(item)

    # 计算各批日期（取批内能识别的最近日期，或回退文件更新时间）
    return {
        "name": name,
        "isMainTheme": name in MAIN_THEMES,
        "isNote": name in ("时政笔记", "重要讲话"),
        "batches": [dict(v, label=k) for k, v in batches.items()],
        "updated": last_date or datetime.fromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d"),
    }

def parse_daily_file(path):
    """解析每日素材文件（每日申论素材（2026-08-25）.md）
    返回: {date, hotEvents, focusThemes, themes:[{name, status, categories:{类别:[items]}}], fileName}
    """
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()

    date = None
    hot_events = ""
    focus_themes = []
    themes = OrderedDict()
    current_theme = None
    current_cat = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        # 日期
        if date is None:
            d = parse_date(line)
            if d:
                date = d
        # 核心时政事件
        if "核心时政事件" in line:
            hot_events = line.split("：", 1)[-1].strip() if "：" in line else line
            continue
        if "今日重点展开主题" in line or "重点展开主题" in line:
            seg = line.split("：", 1)[-1] if "：" in line else line
            focus_themes = [x.strip().strip("【】*") for x in re.findall(r'【([^】]+)】', seg)] or [seg]
            continue
        # 主题 ## 一、基层治理（今日重点）
        if line.startswith("## "):
            t = line[3:].strip()
            st = None
            if "今日重点" in t or "重点" in t:
                st = "今日重点"
            # 去掉编号
            t = re.sub(r'^[一二三四五六七八九十]+[、.]\s*', '', t)
            t = re.sub(r'（.*）', '', t).strip()
            if t:
                current_theme = t
                themes.setdefault(current_theme, {"name": t, "status": st, "categories": OrderedDict()})
                current_cat = None
            continue
        # 类别 ### 【金句】
        if line.startswith("### "):
            t = line[4:].strip().strip("【】")
            cat = CAT_ALIAS.get(t)
            if cat and current_theme:
                current_cat = cat
                themes[current_theme]["categories"].setdefault(cat, [])
            continue
        # 条目
        if (line.startswith("-") or line.startswith("*") or re.match(r'^[（(]?\d+[\.、）)]', line)) and current_theme and current_cat:
            item = norm_item(line)
            if item:
                # 去掉可能的括号来源说明
                themes[current_theme]["categories"][current_cat].append(item)

    return {
        "date": date or parse_date(os.path.basename(path)) or "未知",
        "hotEvents": hot_events,
        "focusThemes": focus_themes,
        "themes": list(themes.values()),
        "fileName": os.path.basename(path),
    }

def parse_notes_file(path):
    """解析时政笔记 / 重要讲话（按日期分节的深度笔记）"""
    name = os.path.splitext(os.path.basename(path))[0]
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    notes = []
    cur = None
    for raw in lines:
        line = raw.strip()
        if not line or line == "---":
            continue
        if line.startswith("### ") or line.startswith("## "):
            head = line.lstrip('#').strip()
            d = parse_date(head)
            cur = {"date": d, "title": head, "items": []}
            notes.append(cur)
            continue
        if cur is not None and (line.startswith("-") or line.startswith("*") or re.match(r'^\d+[.、]', line)):
            it = norm_item(line)
            if it:
                cur["items"].append(it)
    return {"name": name, "isMainTheme": name in MAIN_THEMES, "isNote": True,
            "notes": notes,
            "updated": (notes[0]["date"] if notes and notes[0]["date"] else datetime.now().strftime("%Y-%m-%d"))}


def main():
    data = {"generatedAt": datetime.now().strftime("%Y-%m-%d %H:%M"), "projects": []}

    # 1. 主题素材库
    lib_files = glob.glob(os.path.join(LIB_DIR, "*.md"))
    lib = []
    for p in sorted(lib_files):
        b = os.path.basename(p)
        if b.startswith(("时政笔记", "重要讲话")):
            lib.append(parse_notes_file(p))
        else:
            lib.append(parse_theme_file(p))
    data["library"] = lib

    # 2. 每日素材
    daily_files = glob.glob(os.path.join(DAILY_DIR, "每日申论素材*.md"))
    daily = []
    for p in daily_files:
        d = parse_daily_file(p)
        if d["date"] != "未知":
            daily.append(d)
    daily.sort(key=lambda x: x["date"], reverse=True)
    data["daily"] = daily

    # 3. 简单统计（条目数）
    total_items = sum(len(items) for t in lib if not t["isNote"] for b in t["batches"] for items in b["categories"].values())
    total_items += sum(len(n["items"]) for t in lib if t["isNote"] for n in t["notes"])
    def _c(t):
        return (sum(len(items) for b in t["batches"] for items in b["categories"].values()) if not t["isNote"]
                else sum(len(n["items"]) for n in t["notes"]))
    theme_counts = {t["name"]: _c(t) for t in lib}
    data["stats"] = {
        "dailyCount": len(daily),
        "themeCount": len([t for t in lib if t["isMainTheme"]]),
        "totalItems": total_items,
        "themeCounts": theme_counts,
    }

    # 输出为 data.js
    js = "window.DASHBOARD_DATA = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n"
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"OK -> {OUT_PATH}  (daily={len(daily)}, themes={len(lib)}, items={total_items})")

if __name__ == "__main__":
    main()
