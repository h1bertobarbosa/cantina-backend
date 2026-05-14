docker build -t h1bertobarbosa/cantina-backend:latest -f Dockerfile .
docker push h1bertobarbosa/cantina-backend:latest
ssh root@udv "docker pull h1bertobarbosa/cantina-backend:latest && docker service update --image h1bertobarbosa/cantina-backend:latest cantina_cantinabackend"
