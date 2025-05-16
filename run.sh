# run.sh
while true; do
  echo "Starting Bun server..."
  bun run index.js
  echo "Server crashed with exit code $? — restarting in 3 seconds..."
  sleep 3
done