# -*- coding: utf-8 -*-
"""
拼豆图纸生成器 - Flask后端
核心改进：CIE-Lab 色彩空间匹配，感知均匀，天然抗羽化
"""

import os
import json
import uuid
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify, render_template

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__,
            static_folder=os.path.join(BASE_DIR, 'static'),
            template_folder=os.path.join(BASE_DIR, 'templates'))
app.config['UPLOAD_FOLDER'] = os.path.join(BASE_DIR, 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def load_color_card(brand='mard'):
    path = os.path.join(BASE_DIR, 'static', 'data', 'color_cards', f'{brand}.json')
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


# ========== CIE-Lab 色彩空间 ==========

def srgb_to_linear(c):
    """sRGB gamma 解码"""
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb_to_xyz(rgb):
    """RGB → XYZ（D65 光源）"""
    r, g, b = rgb
    r_lin = srgb_to_linear(r)
    g_lin = srgb_to_linear(g)
    b_lin = srgb_to_linear(b)
    x = 0.4124564 * r_lin + 0.3575761 * g_lin + 0.1804375 * b_lin
    y = 0.2126729 * r_lin + 0.7151522 * g_lin + 0.0721750 * b_lin
    z = 0.0193339 * r_lin + 0.1191920 * g_lin + 0.9503041 * b_lin
    return x, y, z


def xyz_to_lab(xyz):
    """XYZ → Lab（D65 参考白点）"""
    x, y, z = xyz
    # D65 白点
    xn, yn, zn = 0.95047, 1.0, 1.08883

    def f(t):
        delta = 6.0 / 29.0
        return t ** (1.0 / 3.0) if t > delta ** 3 else t / (3 * delta ** 2) + 4.0 / 29.0

    fx = f(x / xn)
    fy = f(y / yn)
    fz = f(z / zn)

    L = 116.0 * fy - 16.0
    a = 500.0 * (fx - fy)
    b = 200.0 * (fy - fz)
    return L, a, b


def rgb_to_lab(rgb):
    """RGB → Lab"""
    return xyz_to_lab(rgb_to_xyz(rgb))


def lab_distance(lab1, lab2):
    """CIE-Lab 欧氏距离（ΔE*ab）"""
    dL = lab1[0] - lab2[0]
    da = lab1[1] - lab2[1]
    db = lab1[2] - lab2[2]
    return np.sqrt(dL * dL + da * da + db * db)


def find_nearest_color(pixel_rgb, color_list_lab):
    """用 CIE-Lab 距离找最接近的色卡颜色"""
    pixel_lab = rgb_to_lab(pixel_rgb)
    min_dist = float('inf')
    nearest = None
    for c in color_list_lab:
        dist = lab_distance(pixel_lab, c['lab'])
        if dist < min_dist:
            min_dist = dist
            nearest = c
    return nearest


def pixelate_image(image_path, grid_width, grid_height, brand='mard',
                   max_colors=None, tolerance=0):
    """
    图片像素化并映射到拼豆色卡

    核心算法：CIE-Lab 色彩空间匹配
    - Lab 是感知均匀的：数值接近 = 视觉接近
    """
    color_card = load_color_card(brand)
    color_list = color_card['colors']

    # 预计算色卡的 Lab 值
    color_list_lab = []
    for c in color_list:
        color_list_lab.append({
            'code': c['code'],
            'name': c['name'],
            'rgb': c['rgb'],
            'lab': rgb_to_lab(c['rgb'])
        })

    # 打开图片，处理透明通道
    img = Image.open(image_path)
    if img.mode == 'RGBA':
        bg = Image.new('RGBA', img.size, (255, 255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg.convert('RGB')
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    # 缩放到目标尺寸
    img_resized = img.resize((grid_width, grid_height), Image.LANCZOS)
    pixels = np.array(img_resized)

    # 构建网格数据
    raw_grid = []
    for row in range(grid_height):
        grid_row = []
        for col in range(grid_width):
            pixel_rgb = tuple(int(x) for x in pixels[row, col])
            nearest = find_nearest_color(pixel_rgb, color_list_lab)
            grid_row.append({
                'code': nearest['code'],
                'name': nearest['name'],
                'rgb': nearest['rgb'],
                'original_rgb': list(pixel_rgb)
            })
        raw_grid.append(grid_row)

    # 容差聚类合并（用 Lab 距离）
    if tolerance > 0:
        temp_count = {}
        for row in raw_grid:
            for cell in row:
                k = cell['code']
                if k not in temp_count:
                    temp_count[k] = {'code': cell['code'], 'name': cell['name'],
                                     'rgb': cell['rgb'], 'count': 0}
                temp_count[k]['count'] += 1

        sorted_c = sorted(temp_count.values(), key=lambda x: -x['count'])

        clusters = []
        for c in sorted_c:
            merged_into = None
            min_dist = float('inf')
            c_lab = rgb_to_lab(c['rgb'])
            for cluster in clusters:
                dist = lab_distance(c_lab, cluster['center_lab'])
                if dist < tolerance and dist < min_dist:
                    min_dist = dist
                    merged_into = cluster
            if merged_into:
                merged_into['members'].append(c['code'])
            else:
                clusters.append({
                    'center': c,
                    'center_lab': rgb_to_lab(c['rgb']),
                    'members': [c['code']]
                })

        color_merge_map = {}
        for cluster in clusters:
            center = cluster['center']
            for member_code in cluster['members']:
                color_merge_map[member_code] = {
                    'code': center['code'],
                    'name': center['name'],
                    'rgb': center['rgb']
                }

        for row in raw_grid:
            for cell in row:
                merged = color_merge_map.get(cell['code'])
                if merged and merged['code'] != cell['code']:
                    cell['code'] = merged['code']
                    cell['name'] = merged['name']
                    cell['rgb'] = merged['rgb']

    # 统计最终颜色用量
    color_count = {}
    grid = []
    for row_data in raw_grid:
        grid_row = []
        for cell in row_data:
            grid_row.append(cell)
            k = cell['code']
            if k not in color_count:
                color_count[k] = {'code': cell['code'], 'name': cell['name'],
                                  'rgb': cell['rgb'], 'count': 0}
            color_count[k]['count'] += 1
        grid.append(grid_row)

    # 最大颜色数限制
    if max_colors and len(color_count) > max_colors:
        sorted_colors = sorted(color_count.values(), key=lambda x: -x['count'])
        kept = set(c['code'] for c in sorted_colors[:max_colors])
        kept_list = [c for c in color_list_lab if c['code'] in kept]

        color_count = {}
        for row in range(grid_height):
            for col in range(grid_width):
                cell = grid[row][col]
                if cell['code'] not in kept:
                    nearest = find_nearest_color(cell['original_rgb'], kept_list)
                    cell['code'] = nearest['code']
                    cell['name'] = nearest['name']
                    cell['rgb'] = nearest['rgb']

                key = cell['code']
                if key not in color_count:
                    color_count[key] = {
                        'code': cell['code'],
                        'name': cell['name'],
                        'rgb': cell['rgb'],
                        'count': 0
                    }
                color_count[key]['count'] += 1

    color_stats = sorted(color_count.values(), key=lambda x: -x['count'])
    total_beads = grid_width * grid_height

    return {
        'grid': grid,
        'width': grid_width,
        'height': grid_height,
        'color_stats': color_stats,
        'total_beads': total_beads,
        'brand': color_card['brand']
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/color_cards', methods=['GET'])
def get_color_cards():
    color_cards_dir = os.path.join(BASE_DIR, 'static', 'data', 'color_cards')
    brands = [f.replace('.json', '') for f in os.listdir(color_cards_dir) if f.endswith('.json')]
    return jsonify({'brands': brands})


@app.route('/api/color_card/<brand>', methods=['GET'])
def get_color_card(brand):
    try:
        return jsonify(load_color_card(brand))
    except FileNotFoundError:
        return jsonify({'error': '色卡不存在'}), 404


@app.route('/api/upload', methods=['POST'])
def upload_image():
    if 'image' not in request.files:
        return jsonify({'error': '未上传图片'}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': '未选择文件'}), 400

    grid_size = int(request.form.get('grid_size', 29))
    brand = request.form.get('brand', 'mard')
    max_colors = request.form.get('max_colors', None)
    if max_colors:
        max_colors = int(max_colors)
    tolerance = int(request.form.get('tolerance', 15))

    filename = f"{uuid.uuid4().hex}.png"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        result = pixelate_image(filepath, grid_size, grid_size, brand,
                                max_colors, tolerance)
        result['image_id'] = filename
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("  拼豆图纸生成器")
    print("  打开浏览器访问: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
