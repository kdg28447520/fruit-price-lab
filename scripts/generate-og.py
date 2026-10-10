#!/usr/bin/env python3
"""Build a 1200x630 Open Graph JPEG from locally licensed fruit photos.

Input images are kept under photos/ and credited in data/photos-manifest.json.
No third-party network requests or API credentials are needed.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
import math

W, H = 1200, 630
out = Path("public/og-image.jpg")
out.parent.mkdir(parents=True, exist_ok=True)
image = Image.new("RGB", (W, H))
px = image.load()
for y in range(H):
    for x in range(W):
        t = (x / W) * .53 + (y / H) * .47
        px[x, y] = (round(244 - 12*t), round(250 - 6*t), round(241 - 11*t))
paint = ImageDraw.Draw(image)
paint.ellipse((-220, 340, 290, 830), fill=(226, 244, 231))
paint.ellipse((940, -180, 1450, 310), fill=(229, 244, 224))
paint.rounded_rectangle((70, 66, 315, 106), radius=20, fill=(222, 242, 228))

font_files=[
    "/usr/share/fonts/truetype/nanum/NanumSquareB.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
]
fonts=[p for p in font_files if Path(p).exists()]
if not fonts: raise RuntimeError("Korean font not available. Install fonts-nanum")
def font(size): return ImageFont.truetype(fonts[0],size)
bold, main, small = font(77),font(70),font(27)
tagfont=font(22)
paint.text((92,70),"DATA-DRIVEN FRUIT PRICES",font=font(18),fill=(24,117,73))
paint.text((80,165),"제철과일",font=bold,fill=(12,82,55),stroke_width=0)
paint.text((80,266),"시세 연구소",font=main,fill=(13,129,79))
paint.text((86,409),"과일 품종별 시세 · 최근 1년 가격추이",font=small,fill=(53,93,70))
paint.text((86,462),"쿠팡 판매 마진 계산까지 한 번에",font=small,fill=(53,93,70))
paint.rounded_rectangle((82,555,426,601),radius=22,fill=(17,133,85))
paint.text((109,561),"공공데이터 기반 과일 가격 분석",font=tagfont,fill=(255,255,255))

def tile(photo,box,radius=30):
    p=Path(photo)
    if not p.exists(): raise FileNotFoundError(p)
    x,y,w,h=box
    base=Image.open(p).convert("RGB")
    # Stretch-free centered crop to fill a card, preserving real photographed fruit.
    cropped=ImageOps.fit(base,(w,h),Image.Resampling.LANCZOS,centering=(.5,.5))
    mask=Image.new("L",(w,h),0)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,w-1,h-1),radius=radius,fill=255)
    # Soft shadow
    shadow=Image.new("RGBA",(w+26,h+26),(0,0,0,0))
    ImageDraw.Draw(shadow).rounded_rectangle((13,12,w+11,h+10),radius=radius,fill=(24,79,49,57))
    image.paste(shadow.filter(ImageFilter.GaussianBlur(11)),(x-13,y-13),shadow.filter(ImageFilter.GaussianBlur(11)))
    image.paste(cropped,(x,y),mask)

tile("photos/fruit-apple.jpg",(750,58,364,328),30)
tile("photos/fruit-grapes.jpg",(660,372,251,212),28)
tile("photos/fruit-mandarin.jpg",(935,392,217,192),27)
paint=ImageDraw.Draw(image)
paint.rounded_rectangle((743,57,1115,389),radius=33,outline=(252,255,251),width=4)
paint.rounded_rectangle((655,368,914,588),radius=31,outline=(252,255,251),width=4)
paint.rounded_rectangle((930,388,1156,588),radius=29,outline=(252,255,251),width=4)
image.save(out,"JPEG",quality=87,optimize=True,subsampling=0)
assert Image.open(out).size==(1200,630)
print(f"Generated {out} (1200x630), {out.stat().st_size} bytes")
