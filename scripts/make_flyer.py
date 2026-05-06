"""Generate Terango Driver & Rider A4 flyer (300 DPI)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT = r"C:\Users\bassa\Downloads\terango-flyer.png"

# A4 at 300 DPI
W, H = 2480, 3508

# Brand palette
GREEN = (0, 133, 63)
GREEN_LIGHT = (0, 166, 80)
GREEN_DARK = (0, 26, 18)
GREEN_DEEPER = (0, 15, 10)
YELLOW = (253, 239, 66)
YELLOW_GOLD = (212, 175, 55)
RED = (227, 27, 35)
WHITE = (255, 255, 255)
CREAM = (250, 245, 230)

# Fonts
SEG_B = r"C:\Windows\Fonts\segoeuib.ttf"
SEG   = r"C:\Windows\Fonts\segoeui.ttf"
SEG_BLK = r"C:\Windows\Fonts\seguibl.ttf"
if not os.path.exists(SEG_BLK):
    SEG_BLK = SEG_B

def f(p, s): return ImageFont.truetype(p, s)

# ---------- BACKGROUND: Monument de la Renaissance (cinematic) ----------
img = Image.new("RGB", (W, H), GREEN_DEEPER)

# Use the sunset/monument Gemini image as background
bg_src = Image.open(r"C:\Users\bassa\Downloads\Gemini_Generated_Image_g6yw9gg6yw9gg6yw.png").convert("RGB")
bw_, bh_ = bg_src.size
# cover the canvas
scale = max(W / bw_, H / bh_)
bg = bg_src.resize((int(bw_ * scale), int(bh_ * scale)), Image.LANCZOS)
# center-crop
bx = (bg.size[0] - W) // 2
by = (bg.size[1] - H) // 2
bg = bg.crop((bx, by, bx + W, by + H))

# very light blur so monument silhouette stays recognizable
bg = bg.filter(ImageFilter.GaussianBlur(3))

from PIL import ImageEnhance
bg = ImageEnhance.Brightness(bg).enhance(0.70)
bg = ImageEnhance.Contrast(bg).enhance(1.15)
bg = ImageEnhance.Color(bg).enhance(0.85)

img.paste(bg, (0, 0))

# Green tint layer — keeps brand feel, lets monument show through
tint = Image.new("RGBA", (W, H), (0, 40, 25, 110))
img.paste(tint, (0, 0), tint)

# Readability overlay: darker in header + footer bands where text lives,
# lighter across the middle so the hero stays visible
overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
for y in range(H):
    t = y / H
    if t < 0.25:
        a = int(200 * (1 - t / 0.25) + 90)       # 200 → 90
    elif t < 0.55:
        a = 80                                    # lightest in mid
    elif t < 0.80:
        a = int(80 + (t - 0.55) / 0.25 * 140)    # ramp up
    else:
        a = 220
    od.line([(0, y), (W, y)], fill=(0, 18, 12, a))
img.paste(overlay, (0, 0), overlay)

# Bottom vignette for footer text pop
vignette = Image.new("RGBA", (W, H), (0, 0, 0, 0))
vd = ImageDraw.Draw(vignette)
vd.rectangle([0, int(H * 0.70), W, H], fill=(0, 10, 8, 180))
vignette = vignette.filter(ImageFilter.GaussianBlur(80))
img.paste(vignette, (0, 0), vignette)

draw = ImageDraw.Draw(img)

# Subtle decorative angled stripe (yellow + red accents - Senegal flag nod)
stripe = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(stripe)
# diagonal yellow streak across top-right
sd.polygon([(W - 900, 0), (W, 0), (W, 600), (W - 300, 600)], fill=(*YELLOW_GOLD, 55))
sd.polygon([(W - 500, 0), (W, 0), (W, 300), (W - 200, 300)], fill=(*RED, 45))
# bottom-left green glow
sd.polygon([(0, H - 700), (400, H), (0, H)], fill=(*GREEN_LIGHT, 60))
stripe = stripe.filter(ImageFilter.GaussianBlur(2))
img.paste(stripe, (0, 0), stripe)

# ---------- HEADER ----------
margin = 140
header_y = 120

# Small pill: SENEGAL
pill_font = f(SEG_B, 46)
pill_txt = "🇸🇳  DAKAR • SÉNÉGAL"
# Using text without emoji to avoid font issues
pill_txt = "DAKAR  •  SÉNÉGAL"
bbox = draw.textbbox((0, 0), pill_txt, font=pill_font)
pw = bbox[2] - bbox[0] + 80
ph = bbox[3] - bbox[1] + 40
draw.rounded_rectangle([margin, header_y, margin + pw, header_y + ph], radius=ph // 2,
                       fill=(*YELLOW, 255))
draw.text((margin + 40, header_y + 12), pill_txt, font=pill_font, fill=GREEN_DARK)

# Title: TeranGO (Teran white, GO yellow — one word)
title_font = f(SEG_BLK, 340)
title_y = header_y + ph + 30
teran = "Teran"
go = "GO"
tb = draw.textbbox((0, 0), teran, font=title_font)
teran_w = tb[2] - tb[0]
draw.text((margin, title_y), teran, font=title_font, fill=WHITE)
draw.text((margin + teran_w, title_y), go, font=title_font, fill=YELLOW)

# Subtitle
sub_font = f(SEG_B, 58)
draw.text((margin, header_y + ph + 30 + 420), "Sunu Teranga  •  Sunu Moomel",
          font=sub_font, fill=YELLOW)

# Tagline small
tag_font = f(SEG, 54)
draw.text((margin, header_y + ph + 30 + 420 + 100),
          "Rejoignez la révolution du transport au Sénégal.",
          font=tag_font, fill=(220, 235, 225))

# ---------- HERO IMAGES ----------
hero_y = 1040
img_w = (W - margin * 2 - 60) // 2  # two images side by side with gap
img_h = 720

def fit_cover(src_path, tw, th):
    src = Image.open(src_path).convert("RGBA")
    sw, sh = src.size
    scale = max(tw / sw, th / sh)
    nw, nh = int(sw * scale), int(sh * scale)
    src = src.resize((nw, nh), Image.LANCZOS)
    x = (nw - tw) // 2
    y = (nh - th) // 2
    return src.crop((x, y, x + tw, y + th))

def rounded_image(src, radius):
    mask = Image.new("L", src.size, 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, src.size[0], src.size[1]], radius=radius, fill=255)
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    out.paste(src, (0, 0), mask)
    return out

hero1 = fit_cover(r"C:\Users\bassa\Downloads\Gemini_Generated_Image_mpjqc3mpjqc3mpjq.png", img_w, img_h)
hero2 = fit_cover(r"C:\Users\bassa\Downloads\Gemini_Generated_Image_g6yw9gg6yw9gg6yw.png", img_w, img_h)
hero1 = rounded_image(hero1, 60)
hero2 = rounded_image(hero2, 60)

# Drop shadow
def paste_with_shadow(base, layer, x, y, blur=30, offset=(0, 20), opacity=140):
    shadow = Image.new("RGBA", base.size, (0, 0, 0, 0))
    sd2 = ImageDraw.Draw(shadow)
    # create shadow from alpha
    alpha = layer.split()[-1]
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sh.putalpha(alpha.point(lambda p: min(255, int(p * opacity / 255))))
    shadow.paste(sh, (x + offset[0], y + offset[1]), sh)
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    base.paste(shadow, (0, 0), shadow)
    base.paste(layer, (x, y), layer)

paste_with_shadow(img, hero1, margin, hero_y)
paste_with_shadow(img, hero2, margin + img_w + 60, hero_y)

# Labels under hero images
lab_font = f(SEG_B, 56)
draw.text((margin + 20, hero_y + img_h + 30), "PASSAGERS", font=lab_font, fill=YELLOW)
draw.text((margin + img_w + 80, hero_y + img_h + 30), "CHAUFFEURS", font=lab_font, fill=YELLOW)

# ---------- DIVIDER ----------
div_y = hero_y + img_h + 100
draw.line([(margin, div_y), (W - margin, div_y)], fill=(*YELLOW_GOLD, 180), width=4)

# ---------- CTA HEADLINE ----------
cta_y = div_y + 50
cta_font = f(SEG_BLK, 110)
draw.text((margin, cta_y), "SCANNEZ & TÉLÉCHARGEZ", font=cta_font, fill=WHITE)
cta_sub = f(SEG, 50)
draw.text((margin, cta_y + 135),
          "Deux applications. Une seule famille Terango.",
          font=cta_sub, fill=(220, 235, 225))

# Android-only badge
android_font = f(SEG_B, 44)
android_txt = "📱  DISPONIBLE SUR ANDROID UNIQUEMENT"
android_txt = "DISPONIBLE SUR ANDROID UNIQUEMENT"
ab = draw.textbbox((0, 0), android_txt, font=android_font)
aw = ab[2] - ab[0] + 70
ah = ab[3] - ab[1] + 30
ax = margin
ay = cta_y + 210
draw.rounded_rectangle([ax, ay, ax + aw, ay + ah], radius=ah // 2,
                       fill=(*GREEN_LIGHT, 255))
draw.text((ax + 35, ay + 8), android_txt, font=android_font, fill=WHITE)

# ---------- QR PANELS ----------
panel_y = ay + ah + 30
panel_w = (W - margin * 2 - 80) // 2
panel_h = 780
gap = 80

def draw_qr_panel(x, y, title, subtitle, qr_path, accent, url_text="", icon_path=None):
    # panel bg
    panel = Image.new("RGBA", (panel_w, panel_h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(panel)
    pd.rounded_rectangle([0, 0, panel_w, panel_h], radius=50, fill=(*WHITE, 250))
    # top accent bar
    pd.rounded_rectangle([0, 0, panel_w, 140], radius=50, fill=(*accent, 255))
    pd.rectangle([0, 70, panel_w, 140], fill=(*accent, 255))
    img.paste(panel, (x, y), panel)

    # title on accent bar
    tf = f(SEG_BLK, 82)
    tb = draw.textbbox((0, 0), title, font=tf)
    tw = tb[2] - tb[0]
    draw.text((x + (panel_w - tw) // 2, y + 25), title, font=tf, fill=WHITE)

    # subtitle
    sf = f(SEG, 48)
    sb = draw.textbbox((0, 0), subtitle, font=sf)
    sw = sb[2] - sb[0]
    draw.text((x + (panel_w - sw) // 2, y + 170), subtitle, font=sf, fill=GREEN_DARK)

    # QR
    qr_size = 460
    qr = Image.open(qr_path).convert("RGB").resize((qr_size, qr_size), Image.LANCZOS)
    qx = x + (panel_w - qr_size) // 2
    qy = y + 210
    # white frame with rounded corners
    frame = Image.new("RGBA", (qr_size + 60, qr_size + 60), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle([0, 0, qr_size + 60, qr_size + 60], radius=30, fill=(245, 245, 245, 255))
    img.paste(frame, (qx - 30, qy - 30), frame)
    img.paste(qr, (qx, qy))

    # URL line
    if url_text:
        uf = f(SEG_BLK, 52)
        ub = draw.textbbox((0, 0), url_text, font=uf)
        uw = ub[2] - ub[0]
        draw.text((x + (panel_w - uw) // 2, y + panel_h - 130), url_text,
                  font=uf, fill=accent)
    # bottom label
    bf = f(SEG_B, 36)
    bt = "Scannez ou tapez l'adresse ci-dessus"
    bb = draw.textbbox((0, 0), bt, font=bf)
    bw = bb[2] - bb[0]
    draw.text((x + (panel_w - bw) // 2, y + panel_h - 65), bt, font=bf, fill=(90, 90, 90))

draw_qr_panel(margin, panel_y,
              "RIDER  •  PASSAGER",
              "Commandez. Payez. Voyagez.",
              r"C:\Users\bassa\Downloads\qr-terango-rider.png",
              GREEN,
              url_text="terango.sn/client")

draw_qr_panel(margin + panel_w + gap, panel_y,
              "DRIVER  •  CHAUFFEUR",
              "Conduisez. Gagnez. Grandissez.",
              r"C:\Users\bassa\Downloads\qr-terango-driver.png",
              RED,
              url_text="terango.sn")

# ---------- SOCIAL / CONTACT BAR ----------
social_y = panel_y + panel_h + 25

# WhatsApp icon (green circle + white phone handset)
def draw_whatsapp(cx, cy, r):
    # green circle
    bbox = [cx - r, cy - r, cx + r, cy + r]
    draw.ellipse(bbox, fill=(37, 211, 102))
    # simple white phone handset glyph (rounded rectangle tilted)
    hs = r * 1.15
    handset = Image.new("RGBA", (int(hs * 2), int(hs * 2)), (0, 0, 0, 0))
    hd = ImageDraw.Draw(handset)
    # speech bubble style: rounded square with notch
    pad = int(hs * 0.25)
    hd.rounded_rectangle([pad, pad, int(hs * 2) - pad, int(hs * 2) - pad],
                         radius=int(hs * 0.45), fill=(255, 255, 255, 255))
    # tail
    hd.polygon([(pad + 10, int(hs * 2) - pad - 20),
                (pad - 10, int(hs * 2)),
                (pad + 60, int(hs * 2) - pad - 5)],
               fill=(255, 255, 255, 255))
    # phone handset inside
    inner_pad = int(hs * 0.55)
    hd.rounded_rectangle([inner_pad, inner_pad,
                          int(hs * 2) - inner_pad, int(hs * 2) - inner_pad],
                         radius=int(hs * 0.2), fill=(37, 211, 102, 255))
    # horn shape (simplified): two rounded blobs
    hd.ellipse([inner_pad + 8, inner_pad + 8,
                inner_pad + 40, inner_pad + 40], fill=(255, 255, 255, 255))
    hd.ellipse([int(hs * 2) - inner_pad - 40, int(hs * 2) - inner_pad - 40,
                int(hs * 2) - inner_pad - 8, int(hs * 2) - inner_pad - 8],
               fill=(255, 255, 255, 255))
    hd.rectangle([inner_pad + 24, inner_pad + 24,
                  int(hs * 2) - inner_pad - 24, int(hs * 2) - inner_pad - 24],
                 fill=(255, 255, 255, 255))
    img.paste(handset, (cx - int(hs), cy - int(hs)), handset)

# TikTok icon (black rounded square + cyan/magenta offset "d" note)
def draw_tiktok(cx, cy, size):
    s = size
    tile = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    td.rounded_rectangle([0, 0, s, s], radius=int(s * 0.22), fill=(0, 0, 0, 255))
    # simplified musical note "d": ellipse base + vertical stem
    # cyan shadow offset left
    def note(color, ox, oy):
        cx_ = int(s * 0.38) + ox
        cy_ = int(s * 0.70) + oy
        rr = int(s * 0.15)
        td.ellipse([cx_ - rr, cy_ - rr, cx_ + rr, cy_ + rr], fill=color)
        # stem
        td.rectangle([cx_ + rr - 8, cy_ - int(s * 0.40),
                      cx_ + rr + 4, cy_], fill=color)
        # hook top
        td.ellipse([cx_ + rr - 10, cy_ - int(s * 0.46),
                    cx_ + rr + 30, cy_ - int(s * 0.30)], fill=color)
    note((37, 244, 238, 255), -10, 6)   # cyan
    note((254, 44, 85, 255), 10, -6)    # magenta
    note((255, 255, 255, 255), 0, 0)    # white on top
    img.paste(tile, (cx - s // 2, cy - s // 2), tile)

# layout: centered row — WhatsApp block (left) | divider | TikTok block (right)
block_y = social_y + 40
icon_r = 75
line_font = f(SEG_B, 58)
hdr_font = f(SEG_BLK, 56)

# --- WhatsApp side ---
wa_x = margin + 80
draw_whatsapp(wa_x + icon_r, block_y + icon_r, icon_r)
draw.text((wa_x + icon_r * 2 + 40, block_y - 5),
          "WHATSAPP", font=hdr_font, fill=YELLOW)
draw.text((wa_x + icon_r * 2 + 40, block_y + 65),
          "+1 704 726 3959", font=line_font, fill=WHITE)
draw.text((wa_x + icon_r * 2 + 40, block_y + 135),
          "+221 78 425 6407", font=line_font, fill=WHITE)

# vertical divider
div_x = W // 2 + 40
draw.line([(div_x, block_y - 10), (div_x, block_y + 210)],
          fill=(*YELLOW_GOLD, 160), width=3)

# --- TikTok side ---
tk_x = div_x + 80
draw_tiktok(tk_x + icon_r, block_y + icon_r, icon_r * 2)
draw.text((tk_x + icon_r * 2 + 40, block_y - 5),
          "SUIVEZ-NOUS SUR TIKTOK", font=hdr_font, fill=YELLOW)
draw.text((tk_x + icon_r * 2 + 40, block_y + 65),
          "@terango_", font=line_font, fill=WHITE)
draw.text((tk_x + icon_r * 2 + 40, block_y + 135),
          "tiktok.com/@terango_", font=f(SEG, 44), fill=(220, 235, 225))

# Footer tagline
footer_y = block_y + 230
ff_small = f(SEG, 40)
tag2 = "Fabriqué à Dakar, par des Sénégalais, pour le Sénégal."
b2 = draw.textbbox((0, 0), tag2, font=ff_small)
lw2 = b2[2] - b2[0]
draw.text(((W - lw2) // 2, footer_y), tag2, font=ff_small, fill=(230, 230, 230))

# brand line
ff_big = f(SEG_BLK, 56)
brand = "terango.sn   •   terango.sn/client   •   #TeamDakar"
bb = draw.textbbox((0, 0), brand, font=ff_big)
bw = bb[2] - bb[0]
draw.text(((W - bw) // 2, footer_y + 65), brand, font=ff_big, fill=YELLOW)

# ---------- RIDER ICON badge top right ----------
try:
    icon = Image.open(r"C:\Users\bassa\Downloads\rider-icon-512.png").convert("RGBA")
    icon = icon.resize((360, 360), Image.LANCZOS)
    # circular mask
    m = Image.new("L", icon.size, 0)
    ImageDraw.Draw(m).ellipse([0, 0, icon.size[0], icon.size[1]], fill=255)
    icon.putalpha(m)
    # white ring
    ring = Image.new("RGBA", (400, 400), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse([0, 0, 400, 400], fill=(*YELLOW, 255))
    img.paste(ring, (W - margin - 400, header_y), ring)
    img.paste(icon, (W - margin - 400 + 20, header_y + 20), icon)
except Exception as e:
    print("icon err", e)

img.save(OUT, "PNG", optimize=True)
print("Saved:", OUT, img.size)
