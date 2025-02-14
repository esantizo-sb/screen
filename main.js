const socket = io('https://your-server-url.com');  // Replace with actual server URL

class WebShareApp {
  constructor() {
    this.initializeElements();
    this.setupEventListeners();
    this.mediaStream = null;
    this.isHost = false;
    this.screensFrozen = false;
  }

  initializeElements() {
    // Panels
    this.roleSelector = document.getElementById('roleSelector');
    this.hostPanel = document.getElementById('hostPanel');
    this.observerPanel = document.getElementById('observerPanel');
    
    // Buttons
    this.hostBtn = document.getElementById('hostBtn');
    this.observerBtn = document.getElementById('observerBtn');
    this.shareScreenBtn = document.getElementById('shareScreenBtn');
    this.shareDocumentBtn = document.getElementById('shareDocumentBtn');
    this.shareLinkBtn = document.getElementById('shareLinkBtn');
    this.freezeScreensBtn = document.getElementById('freezeScreensBtn');
    
    // Other elements
    this.screenPreview = document.getElementById('screenPreview');
    this.observerScreen = document.getElementById('observerScreen');
    this.userCount = document.getElementById('userCount');
    this.fileInput = document.getElementById('fileInput');
    this.documentArea = document.getElementById('documentArea');
  }

  setupEventListeners() {
    this.hostBtn.addEventListener('click', () => this.setRole('host'));
    this.observerBtn.addEventListener('click', () => this.setRole('observer'));
    this.shareScreenBtn.addEventListener('click', () => this.startScreenShare());
    this.shareDocumentBtn.addEventListener('click', () => this.fileInput.click());
    this.shareLinkBtn.addEventListener('click', () => this.shareLink());
    this.freezeScreensBtn.addEventListener('click', () => this.toggleFreezeScreens());
    this.fileInput.addEventListener('change', (e) => this.handleFileShare(e));

    // Socket events
    socket.on('userCount', (count) => {
      this.userCount.textContent = count;
    });

    socket.on('screenData', (data) => {
      if (!this.isHost) {
        this.displayReceivedScreen(data);
      }
    });

    socket.on('documentData', (data) => {
      if (!this.isHost) {
        this.displayReceivedDocument(data);
      }
    });

    socket.on('freezeScreens', (frozen) => {
      if (!this.isHost) {
        this.handleScreenFreeze(frozen);
      }
    });

    socket.on('sharedLink', (url) => {
      if (!this.isHost) {
        this.handleReceivedLink(url);
      }
    });
  }

  setRole(role) {
    this.isHost = role === 'host';
    this.roleSelector.classList.add('hidden');
    
    if (this.isHost) {
      this.hostPanel.classList.remove('hidden');
      socket.emit('setRole', 'host');
    } else {
      this.observerPanel.classList.remove('hidden');
      socket.emit('setRole', 'observer');
    }
  }

  async startScreenShare() {
    try {
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      const videoTrack = this.mediaStream.getVideoTracks()[0];
      
      // Show preview for host
      const videoElement = document.createElement('video');
      videoElement.srcObject = this.mediaStream;
      videoElement.autoplay = true;
      this.screenPreview.innerHTML = '';
      this.screenPreview.appendChild(videoElement);

      // Set up screen capture and sending
      const imageCapture = new ImageCapture(videoTrack);
      
      setInterval(async () => {
        if (this.mediaStream && this.isHost) {
          const bitmap = await imageCapture.grabFrame();
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext('2d');
          context.drawImage(bitmap, 0, 0);
          
          const screenData = canvas.toDataURL('image/jpeg', 0.7);
          socket.emit('screenShare', screenData);
        }
      }, 1000 / 30); // 30 fps

    } catch (error) {
      console.error('Error sharing screen:', error);
    }
  }

  handleFileShare(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      this.documentArea.classList.remove('hidden');
      this.screenPreview.classList.add('hidden');
      
      if (file.type === 'application/pdf') {
        this.documentArea.innerHTML = `<embed src="${content}" type="application/pdf" width="100%" height="100%">`;
      } else {
        this.documentArea.innerHTML = `<pre>${content}</pre>`;
      }
      
      socket.emit('documentShare', {
        content,
        type: file.type,
        name: file.name
      });
    };
    
    reader.readAsDataURL(file);
  }

  shareLink() {
    const url = prompt('Enter the URL to share:');
    if (url) {
      socket.emit('shareLink', url);
    }
  }

  toggleFreezeScreens() {
    this.screensFrozen = !this.screensFrozen;
    this.freezeScreensBtn.classList.toggle('active');
    socket.emit('freezeScreens', this.screensFrozen);
  }

  displayReceivedScreen(data) {
    const img = new Image();
    img.src = data;
    this.observerScreen.innerHTML = '';
    this.observerScreen.appendChild(img);
  }

  displayReceivedDocument(data) {
    this.observerScreen.innerHTML = '';
    if (data.type === 'application/pdf') {
      this.observerScreen.innerHTML = `<embed src="${data.content}" type="application/pdf" width="100%" height="100%">`;
    } else {
      this.observerScreen.innerHTML = `<pre>${data.content}</pre>`;
    }
  }

  handleScreenFreeze(frozen) {
    this.observerScreen.classList.toggle('frozen', frozen);
  }

  handleReceivedLink(url) {
    const shouldOpen = confirm(`The host wants to share a link: ${url}\nDo you want to open it?`);
    if (shouldOpen) {
      window.open(url, '_blank');
    }
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  new WebShareApp();
});