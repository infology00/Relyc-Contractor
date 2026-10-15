set -e
cd "$(dirname "$0")/../.."
FB='C\:/Windows/Fonts/arialbd.ttf'
FR='C\:/Windows/Fonts/arial.ttf'
ffmpeg -v error -y \
 -i assets/img/act1-poster.jpg \
 -i assets/img/mark-256.png \
 -filter_complex "\
[0:v]scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630,eq=brightness=-0.17:saturation=0.5[bg];\
[bg]drawbox=x=0:y=0:w=1200:h=630:color=#05070A@0.7:t=fill[bg2];\
[1:v]scale=88:88[mk];\
[bg2][mk]overlay=x=78:y=68[c1];\
[c1]drawtext=fontfile='$FB':text='RELYC CONTRACTOR':x=186:y=84:fontsize=30:fontcolor=#F4F6F8[c2];\
[c2]drawtext=fontfile='$FR':text='FL STATE GENERAL CONTRACTOR   CGC1534523':x=188:y=124:fontsize=17:fontcolor=#8C99A8[c3];\
[c3]drawbox=x=78:y=232:w=64:h=4:color=#E39B26:t=fill[c4];\
[c4]drawtext=fontfile='$FB':text='Full-Scope General Contracting':x=78:y=272:fontsize=50:fontcolor=#FFFFFF[c5];\
[c5]drawtext=fontfile='$FB':text='for Industrial, Commercial \& Government':x=78:y=332:fontsize=50:fontcolor=#FFFFFF[c6];\
[c6]drawtext=fontfile='$FB':text='Projects.':x=78:y=392:fontsize=50:fontcolor=#E39B26[c7];\
[c7]drawtext=fontfile='$FR':text='Single-source accountability   Hialeah, FL   Miami-Dade, Broward \& Palm Beach':x=78:y=502:fontsize=21:fontcolor=#A5B1BF[c8];\
[c8]drawtext=fontfile='$FR':text='relyc.co        305-558-9988':x=78:y=544:fontsize=21:fontcolor=#6D7B8B" \
 -frames:v 1 -q:v 3 assets/img/og-default.jpg
echo "OG done: $(du -k assets/img/og-default.jpg | cut -f1)KB"
