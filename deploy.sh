#!/bin/bash
set -ex

pnpm run build
cd dist
tar --no-mac-metadata --no-xattrs -czf ../vertex.tgz *
cd ..
scp vertex.tgz evan@evanmallory.com:~/
rm vertex.tgz

ssh evan@evanmallory.com <<EOF
set -ex
cd evanmallory.com
mkdir -p vertex
cd vertex
tar xzf ~/vertex.tgz
EOF