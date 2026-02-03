function uid() {
  return Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
}

function shuffleArray(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeWheelChannel() {
  // BroadcastChannel works across tabs/windows on the same origin (localhost server).
  const bc = new BroadcastChannel("siena_question_wheel_channel_v1");
  return {
    post: (msg) => bc.postMessage(msg),
    onMessage: (handler) => {
      bc.addEventListener("message", (ev) => handler(ev.data));
    }
  };
}