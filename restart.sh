#!/bin/bash
docker-compose -f /home/sl0ckerius/Tokopedia-Sniper/docker-compose.yml down
docker-compose -f /home/sl0ckerius/Tokopedia-Sniper/docker-compose.yml up --build -d
