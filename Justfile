 
create-video:
	ffmpeg -loop 1 -i alien.png -i audio.mp3 -c:v libx264 -tune stillimage -c:a aac -b:a 192k -shortest audio.mp4

subtitles:
   ffmpeg -i audio.mp4 -vf "subtitles=audio.srt:force_style='FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3,Outline=1,BackColour=&H00FFFF,MarginV=10,MarginL=10,MarginR=10'" -c:a copy output.mp4
