set -e
# Depuis assets/video/ : bash source/encode-hero.sh
SRC=source/Background_1.mp4
S0=30.95; S1=43.70; T0=42.40; CUT=34.533
GRADE="hue=s=0,curves=all='0/0.05 0.5/0.47 1/0.9'"
# Rotation de boucle : [T0→S1] puis fondu 0,6 s vers [S0→T0]
P1=$(python3 -c "print(round($S1-$T0,3))"); OFF=$(python3 -c "print(round($S1-$T0-0.6,3))")
desk_graph="[0:v]trim=start=$S0:end=$S1,setpts=PTS-STARTPTS,decimate=cycle=3,setpts=N/(20*TB),fps=20,$GRADE,scale=1280:720:flags=lanczos,format=yuv420p,split[a][b];
[a]trim=start=$(python3 -c "print(round($T0-$S0,3))"),setpts=PTS-STARTPTS[p1];
[b]trim=end=$(python3 -c "print(round($T0-$S0,3))"),setpts=PTS-STARTPTS[p2];
[p1][p2]xfade=transition=fade:duration=0.6:offset=$OFF,format=yuv420p[v]"
ffmpeg -v error -y -i $SRC -filter_complex "$desk_graph" -map "[v]" -an -c:v libx264 -preset veryslow -crf 20 -profile:v high -level 4.0 -pix_fmt yuv420p -g 40 -movflags +faststart hero.mp4
ffmpeg -v error -y -i $SRC -filter_complex "$desk_graph" -map "[v]" -an -c:v libvpx-vp9 -b:v 0 -crf 31 -row-mt 1 -deadline good -cpu-used 1 -g 40 -pix_fmt yuv420p hero.webm
# Mobile portrait 406x720 : recadrage par plan (foule centrée, puis visage de la femme)
mob_graph="[0:v]trim=start=$S0:end=$S1,setpts=PTS-STARTPTS,decimate=cycle=3,setpts=N/(20*TB),fps=20,$GRADE,split[m1][m2];
[m1]trim=end=$(python3 -c "print(round($CUT-$S0,3))"),setpts=PTS-STARTPTS,crop=406:720:437:0[c];
[m2]trim=start=$(python3 -c "print(round($CUT-$S0,3))"),setpts=PTS-STARTPTS,crop=406:720:170:0[h];
[c][h]concat=n=2:v=1,setpts=PTS-STARTPTS,format=yuv420p,split[a][b];
[a]trim=start=$(python3 -c "print(round($T0-$S0,3))"),setpts=PTS-STARTPTS[p1];
[b]trim=end=$(python3 -c "print(round($T0-$S0,3))"),setpts=PTS-STARTPTS[p2];
[p1][p2]xfade=transition=fade:duration=0.6:offset=$OFF,format=yuv420p[v]"
ffmpeg -v error -y -i $SRC -filter_complex "$mob_graph" -map "[v]" -an -c:v libx264 -preset veryslow -crf 24 -profile:v high -level 4.0 -pix_fmt yuv420p -g 40 -movflags +faststart hero-mobile.mp4
ffmpeg -v error -y -i $SRC -filter_complex "$mob_graph" -map "[v]" -an -c:v libvpx-vp9 -b:v 0 -crf 35 -row-mt 1 -deadline good -cpu-used 1 -g 40 -pix_fmt yuv420p hero-mobile.webm
# Poster = première image exacte de la boucle (partagé par les deux versions)
ffmpeg -v error -y -i hero.mp4 -frames:v 1 -q:v 4 hero-poster.jpg
