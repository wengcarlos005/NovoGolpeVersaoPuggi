import { io } from 'socket.io-client';

function getPid() {
  let pid = localStorage.getItem('golpe_pid');
  if (!pid) {
    pid = crypto.randomUUID();
    localStorage.setItem('golpe_pid', pid);
  }
  return pid;
}

const socket = io({
  autoConnect: false,
  auth: { pid: getPid() },
  reconnectionDelay: 1000,
  reconnectionAttempts: 10,
});

export default socket;
export { getPid };
