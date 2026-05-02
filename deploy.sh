docker buildx build --platform linux/arm64 --load -t verekia/svg-to-msdf .
docker save -o /tmp/svg-to-msdf.tar verekia/svg-to-msdf
scp /tmp/svg-to-msdf.tar midgar:/tmp/
ssh midgar docker load --input /tmp/svg-to-msdf.tar
ssh midgar docker compose up -d svg-to-msdf
