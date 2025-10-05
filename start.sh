#!/bin/sh
foldername=$(basename "$(pwd)")
for session in $(screen -ls | grep -o "[0-9]*\.$foldername"); do screen -S "${session}" -X quit; done
screen -dmS "$foldername" bash
screen -S "$foldername" -X stuff "npm i; npm run migration; npm start \n"
screen -ls