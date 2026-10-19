from PIL import Image, ImageDraw

SIZE = 1024
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Fondo: cuadrado redondeado grafito
bg_color = (28, 31, 38, 255)
radius = 180
draw.rounded_rectangle([0, 0, SIZE, SIZE], radius=radius, fill=bg_color)

orange = (255, 107, 53, 255)
white = (244, 242, 236, 255)

cx, cy = SIZE // 2, SIZE // 2

# Dibuja una llave inglesa (wrench) estilizada, simple, geométrica
# Mango diagonal
import math
angle = 45
length = 560
width = 90
dx = math.cos(math.radians(angle))
dy = math.sin(math.radians(angle))
x1 = cx - dx * length / 2
y1 = cy - dy * length / 2
x2 = cx + dx * length / 2
y2 = cy + dy * length / 2

def thick_line(draw, p1, p2, width, color):
    x1, y1 = p1
    x2, y2 = p2
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy)
    nx, ny = -dy / length, dx / length
    points = [
        (x1 + nx * width / 2, y1 + ny * width / 2),
        (x2 + nx * width / 2, y2 + ny * width / 2),
        (x2 - nx * width / 2, y2 - ny * width / 2),
        (x1 - nx * width / 2, y1 - ny * width / 2),
    ]
    draw.polygon(points, fill=color)

thick_line(draw, (x1, y1), (x2, y2), width, orange)

# Cabezas de la llave en ambos extremos (círculos con hueco hexagonal simplificado a anillo)
def wrench_head(draw, center, outer_r, inner_r, color, bg_color):
    cx, cy = center
    draw.ellipse([cx - outer_r, cy - outer_r, cx + outer_r, cy + outer_r], fill=color)
    draw.ellipse([cx - inner_r, cy - inner_r, cx + inner_r, cy + inner_r], fill=bg_color)

wrench_head(draw, (x1, y1), 140, 78, orange, bg_color)
wrench_head(draw, (x2, y2), 140, 78, orange, bg_color)

img.save("icon_source.png")
print("icon_source.png generado")
