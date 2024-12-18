#!/bin/bash

pnpm run build
cd dist
tar --no-mac-metadata --no-xattrs -czf ../vertex.tgz *
cd ..
scp vertex.tgz evan@evanmallory.com:~/
rm vertex.tgz