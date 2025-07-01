@echo off
chcp 65001 > nul
setlocal enableextensions enabledelayedexpansion

cd /d "D:\nodejs\project-graph-parser\parser\A"

set "source_file=D:\game-dev\cocos\project\zhao-cha\策划案\主线\主线1.json"
set "link_name=主线1.json"

mklink "%link_name%" "%source_file%"

pause