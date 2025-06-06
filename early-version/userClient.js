console.log("Script starting...");

let socket;

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    console.log("Initializing app...");
    
    socket = io();

    // Global variables
    let localStream;
    let remoteStream;
    let peerConnection;
    let currentRoom;
    let remotePeerId;

    // DOM elements
    const localVideo = document.getElementById("localVideo");
    const remoteVideo = document.getElementById("remoteVideo");
    const roomIdInput = document.getElementById("roomId");
    const startCallBtn = document.getElementById("startCall");
    const joinCallBtn = document.getElementById("joinCall");
    const endCallBtn = document.getElementById("endCall");
    const statusDiv = document.getElementById("status");

    console.log("DOM elements loaded:", {
        localVideo: !!localVideo,
        remoteVideo: !!remoteVideo,
        roomIdInput: !!roomIdInput,
        startCallBtn: !!startCallBtn,
        joinCallBtn: !!joinCallBtn,
        endCallBtn: !!endCallBtn,
        statusDiv: !!statusDiv,
    });

    const configuration = {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    async function startLocalStream() {
        try {
            updateStatus("Requesting camera/microphone access...");
            console.log("Requesting getUserMedia...");

            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            console.log("getUserMedia successful, stream:", localStream);
            localVideo.srcObject = localStream;
            updateStatus("Local stream started");
            return true;
        } catch (error) {
            console.error("Error accessing media devices:", error);
            updateStatus(`Error: ${error.message}`);
            alert(
                `Camera/Microphone Error: ${error.message}\n\nMake sure to:\n1. Allow camera/microphone permissions\n2. Use HTTPS or localhost\n3. Check if camera is being used by another app`
            );
            return false;
        }
    }

    function createPeerConnection() {
        console.log("Creating peer connection...");
        peerConnection = new RTCPeerConnection(configuration);

        // Add local stream tracks to peer connection
        if (localStream) {
            localStream.getTracks().forEach((track) => {
                console.log("Adding track to peer connection:", track.kind);
                peerConnection.addTrack(track, localStream);
            });
        } else {
            console.error(
                "No local stream available when creating peer connection"
            );
        }

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log("Received remote track:", event.track.kind);
            if (!remoteStream) {
                remoteStream = new MediaStream();
                remoteVideo.srcObject = remoteStream;
            }
            remoteStream.addTrack(event.track);
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Sending ICE candidate");
                socket.emit("ice-candidate", {
                candidate: event.candidate,
                to: remotePeerId,
                });
            }
        };

        // Connection state change
        peerConnection.onconnectionstatechange = () => {
            console.log("Connection state:", peerConnection.connectionState);
            updateStatus(`Connection state: ${peerConnection.connectionState}`);
        };

        return peerConnection;
    }

    async function startCall() {
        console.log("startCall() function called");

        try {
            const roomId = roomIdInput.value;
            console.log("Room ID:", roomId);

            if (!roomId) {
                console.log("No room ID provided");
                updateStatus("Please enter a room ID");
                return;
            }

            console.log("Attempting to start local stream...");
            const streamStarted = await startLocalStream();

            if (!streamStarted || !localStream) {
                console.error("Failed to start local stream");
                updateStatus("Failed to access camera/microphone");
                return;
            }

            console.log("Local stream started successfully");
            currentRoom = roomId;

            console.log("Socket connected?", socket.connected);
            console.log("Emitting join-room event with room ID:", roomId);
            socket.emit("join-room", roomId);

            startCallBtn.disabled = true;
            joinCallBtn.disabled = true;
            endCallBtn.disabled = false;
            updateStatus(`Waiting for someone to join room: ${roomId}`);

            console.log("startCall() completed successfully");
        } catch (error) {
            console.error("Error in startCall():", error);
            updateStatus(`Error starting call: ${error.message}`);
            alert(`Failed to start call: ${error.message}`);
        }
    }

    async function joinCall() {
        console.log("joinCall() function called");

        try {
            const roomId = roomIdInput.value;
            console.log("Room ID:", roomId);

            if (!roomId) {
                console.log("No room ID provided");
                updateStatus("Please enter a room ID");
                return;
            }

            console.log("Attempting to start local stream...");
            const streamStarted = await startLocalStream();

            if (!streamStarted || !localStream) {
                console.error("Failed to start local stream");
                updateStatus("Failed to access camera/microphone");
                return;
            }

            console.log("Local stream started successfully");
            currentRoom = roomId;

            console.log("Socket connected?", socket.connected);
            console.log("Emitting join-room event with room ID:", roomId);
            socket.emit("join-room", roomId);

            startCallBtn.disabled = true;
            joinCallBtn.disabled = true;
            endCallBtn.disabled = false;
            updateStatus(`Joined room: ${roomId}, waiting for call...`);

            console.log("joinCall() completed successfully");
        } catch (error) {
            console.error("Error in joinCall():", error);
            updateStatus(`Error joining call: ${error.message}`);
            alert(`Failed to join call: ${error.message}`);
        }
    }

    function endCall() {
        console.log("Ending call...");

        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }

        if (localStream) {
            localStream.getTracks().forEach((track) => {
                console.log("Stopping track:", track.kind);
                track.stop();
            });
            localStream = null;
        }

        localVideo.srcObject = null;
        remoteVideo.srcObject = null;
        remoteStream = null;

        if (currentRoom) {
            socket.emit("leave-room", currentRoom);
            currentRoom = null;
        }

        startCallBtn.disabled = false;
        joinCallBtn.disabled = false;
        endCallBtn.disabled = true;
        updateStatus("Call ended");
    }

    function updateStatus(message) {
        statusDiv.textContent = message;
        console.log("[STATUS]", message);
    }

    // Socket event handlers
    socket.on("connect", () => {
        console.log("Connected to signaling server");
        updateStatus("Connected to server");
    });

    socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        updateStatus("Error: Cannot connect to server");
    });

    socket.on("user-connected", async (userId) => {
        console.log("User connected:", userId);
        remotePeerId = userId;
        updateStatus("User connected, creating offer...");

        try {
            peerConnection = createPeerConnection();
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            console.log("Sending offer to:", userId);
            socket.emit("offer", {
                offer: offer,
                to: userId,
            });
        } catch (error) {
            console.error("Error creating offer:", error);
            updateStatus("Error creating offer");
        }
    });

    socket.on("offer", async (data) => {
        console.log("Received offer from:", data.from);
        remotePeerId = data.from;
        updateStatus("Received offer, creating answer...");

        try {
            peerConnection = createPeerConnection();
            await peerConnection.setRemoteDescription(data.offer);

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            console.log("Sending answer to:", data.from);
            socket.emit("answer", {
                answer: answer,
                to: data.from,
            });
        } catch (error) {
            console.error("Error handling offer:", error);
            updateStatus("Error handling offer");
        }
    });

    socket.on("answer", async (data) => {
        console.log("Received answer");
        updateStatus("Received answer, connection established");

        try {
            await peerConnection.setRemoteDescription(data.answer);
        } catch (error) {
            console.error("Error setting remote description:", error);
            updateStatus("Error establishing connection");
        }
    });

    socket.on("ice-candidate", async (data) => {
        console.log("Received ICE candidate");
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(data.candidate);
            } catch (error) {
                console.error("Error adding ICE candidate:", error);
            }
        }
    });

    socket.on("user-disconnected", (userId) => {
        console.log("User disconnected:", userId);
        if (userId === remotePeerId) {
            updateStatus("Remote user disconnected");
            endCall();
        }
    });

    console.log("Setting up event listeners...");

    if (startCallBtn) {
        startCallBtn.addEventListener("click", () => {
            console.log("Start Call button clicked");
            startCall();
        });
        console.log("Start Call button event listener attached");
    } else {
        console.error("Start Call button not found!");
    }

    if (joinCallBtn) {
        joinCallBtn.addEventListener("click", () => {
            console.log("Join Call button clicked");
            joinCall();
        });
        console.log("Join Call button event listener attached");
    } else {
        console.error("Join Call button not found!");
    }

    if (endCallBtn) {
        endCallBtn.addEventListener("click", () => {
            console.log("End Call button clicked");
            endCall();
        });
        console.log("End Call button event listener attached");
    } else {
        console.error("End Call button not found!");
    }

    console.log("Socket.io loaded:", typeof io !== "undefined");
    console.log("Socket object:", socket);
    console.log("Socket connected:", socket.connected);
}