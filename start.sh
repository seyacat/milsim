#!/bin/sh
foldername=$(basename "$(pwd)")
tmux kill-session -t "$foldername" 2>/dev/null
tmux new-session -d -s "$foldername" "git pull; npm i; npm run migration; cd frontend; npm i; npm run build; cd ..; npm start"
tmux ls
