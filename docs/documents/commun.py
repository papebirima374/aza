# Mise en page commune aux deux documents (A4, couleurs et polices de l'institut).
import html

CSS_SITE = "http://localhost:3100/_next/static/chunks/3bjum2d72qkte.css"
LOGO = "/home/user/aza/public/images/logo-rose.png"
LOGO_OR = "/home/user/aza/public/images/logo-or.png"
LOTUS = "/home/user/aza/public/images/lotus-or.png"

STYLE = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: "Manrope", sans-serif; color: #2a1a1d; font-size: 10.5pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; min-height: 297mm; padding: 16mm 16mm 18mm; position: relative; page-break-after: always; overflow: hidden; }
.page:last-child { page-break-after: auto; }
h1, h2, h3, .serif { font-family: "Cormorant Garamond", serif; color: #7E0A4C; font-weight: 600; margin: 0; }
h1 { font-size: 34pt; line-height: 1.05; }
h2 { font-size: 24pt; line-height: 1.1; margin-bottom: 4mm; }
h3 { font-size: 15pt; margin: 5mm 0 1.5mm; }
p { margin: 0 0 2.5mm; }
.chapeau { font-size: 12pt; color: #5c4a4e; max-width: 150mm; }
.doux { color: #6b5a5e; }
.pied { position: absolute; bottom: 8mm; left: 16mm; right: 16mm; display: flex; justify-content: space-between; font-size: 8pt; color: #9a8a8e; border-top: 0.3mm solid #eadde2; padding-top: 2mm; }
.bandeau { background: #3D1218; color: #fff; }
.or { color: #C79A5B; }
.rose { color: #F0349A; }
.etiquette { display: inline-block; font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #C79A5B; }
.tel { width: 58mm; border-radius: 6mm; border: 0.6mm solid #eadde2; box-shadow: 0 2mm 5mm rgba(61,18,24,.12); display: block; }
.tel-petit { width: 44mm; border-radius: 4.5mm; border: 0.5mm solid #eadde2; box-shadow: 0 1.5mm 4mm rgba(61,18,24,.10); display: block; }
.duo { display: grid; grid-template-columns: 1fr 58mm; gap: 8mm; align-items: start; margin: 4mm 0; break-inside: avoid; }
.trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; margin: 4mm 0; break-inside: avoid; }
.trio img, .quatre img { width: 100%; }
.quatre { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 4mm 0; break-inside: avoid; }
.legende { font-size: 8.5pt; color: #6b5a5e; margin-top: 1.5mm; text-align: center; }
ol.etapes { counter-reset: e; list-style: none; padding: 0; margin: 2mm 0; }
ol.etapes > li { counter-increment: e; position: relative; padding-left: 10mm; margin-bottom: 2.6mm; }
ol.etapes > li::before { content: counter(e); position: absolute; left: 0; top: -0.3mm; width: 7mm; height: 7mm; border-radius: 50%; background: #F0349A; color: #fff; font-weight: 700; font-size: 9pt; display: flex; align-items: center; justify-content: center; }
ul.puces { padding-left: 5mm; margin: 1mm 0 3mm; }
ul.puces li { margin-bottom: 1.2mm; }
.encadre { background: #fbf3f7; border-left: 1.2mm solid #F0349A; border-radius: 2mm; padding: 3mm 4mm; margin: 3mm 0; break-inside: avoid; }
.encadre.or { background: #fbf6ef; border-left-color: #C79A5B; color: inherit; }
.encadre.vert { background: #e7f5ec; border-left-color: #0d6b37; }
.encadre b:first-child { color: #7E0A4C; }
table.grille { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 3mm 0; }
table.grille th, table.grille td { border-bottom: 0.3mm solid #eadde2; padding: 2mm 2.5mm; text-align: left; vertical-align: top; }
table.grille th { background: #fbf3f7; color: #7E0A4C; font-weight: 700; }
.bouton { display: inline-block; background: #F0349A; color: #fff; border-radius: 99mm; padding: 0.6mm 3mm; font-weight: 700; font-size: 9pt; white-space: nowrap; }
.touche { display: inline-block; border: 0.3mm solid #d9c8cf; border-radius: 99mm; padding: 0 2.2mm; font-weight: 600; font-size: 9pt; white-space: nowrap; background: #fff; }
.sommaire a { color: inherit; text-decoration: none; }
.sommaire li { display: flex; justify-content: space-between; border-bottom: 0.3mm dotted #d9c8cf; padding: 1.8mm 0; }
.carte { border: 0.4mm solid #eadde2; border-radius: 4mm; padding: 4mm; break-inside: avoid; }
.cartes { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin: 4mm 0; }
.icone { font-size: 18pt; }
"""

def img(nom, classe="tel"):
    return f'<img class="{classe}" src="captures/{nom}.png" alt="">'

def figure(nom, legende="", classe="tel"):
    return f'<figure style="margin:0">{img(nom, classe)}{f"<div class=legende>{legende}</div>" if legende else ""}</figure>'

def page(contenu, pied_gauche="", numero=True, classe=""):
    return f'<section class="page {classe}">{contenu}<div class="pied"><span>{pied_gauche}</span><span class="num"></span></div></section>'

def document(titre, pages):
    return f"""<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>{html.escape(titre)}</title>
<link rel="stylesheet" href="polices.css"><style>{STYLE}</style></head><body>{''.join(pages)}
<script>document.querySelectorAll('.page').forEach((p,i)=>{{const n=p.querySelector('.num'); if(n) n.textContent = i ? (i+1) : '';}});</script>
</body></html>"""
