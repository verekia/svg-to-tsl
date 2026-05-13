docker buildx build --platform linux/arm64 --load -t verekia/svg-to-msdf .
docker save verekia/svg-to-msdf | gzip > /tmp/svg-to-msdf.tar.gz
scp /tmp/svg-to-msdf.tar.gz midgar:/tmp/
ssh midgar docker load --input /tmp/svg-to-msdf.tar.gz
ssh midgar docker compose up -d svg-to-msdf
