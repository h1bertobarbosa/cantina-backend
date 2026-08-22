docker build -t h1bertobarbosa/cantina-backend:latest -f Dockerfile .
docker push h1bertobarbosa/cantina-backend:latest
ssh root@5.252.52.54 "docker pull h1bertobarbosa/cantina-backend:latest && docker service update --image h1bertobarbosa/cantina-backend:latest cantina_cantinabackend"
