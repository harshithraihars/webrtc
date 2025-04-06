import { initializeApp, getApps } from "firebase/app";
import { getFirestore,addDoc,setDoc,onSnapshot,updateDoc,getDoc } from "firebase/firestore";
import { collection, doc } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyCgcNUWKPTIFmLhebNLgxpxNUGJVhQerZo",
  authDomain: "webrtc-c95f3.firebaseapp.com",
  projectId: "webrtc-c95f3",
  storageBucket: "webrtc-c95f3.appspot.com",
  messagingSenderId: "5902951449",
  appId: "1:5902951449:web:40b362dec3cc50eeb0b688",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};
// generate the icecandidates
let pc = new RTCPeerConnection(servers);
const webcamButton = document.querySelector(".webcam");
const startCallButton = document.querySelector(".call");
const InputCode = document.querySelector(".InputCode");
const JoinCallButton = document.querySelector(".join");
const localVideo = document.querySelector("#localVideo");
const remoteVideo = document.querySelector("#remoteVideo");

let localstream = null;
localVideo.srcObject=localstream
let remotestream = new MediaStream();
remoteVideo.srcObject = remotestream;
console.log(
  webcamButton,
  startCallButton,
  InputCode,
  JoinCallButton,
  localVideo,
  remoteVideo
);

webcamButton.addEventListener("click", async () => {
  localstream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  localstream.getTracks().forEach((track) => {
    pc.addTrack(track, localstream);
  });

  localVideo.srcObject = localstream;
  localVideo.muted = true; // Optional: mute local video
});


startCallButton.addEventListener("click", async () => {
  const callDoc = doc(collection(db, "calls"));
  // sub documents for individual
  const offerCandidates = collection(callDoc, "offerCandidates");
  const answerCandidates = collection(callDoc, "answercandidates");

  InputCode.value = callDoc.id;

  // ice candidate is a potential ip address and port number which helps you to connect
  pc.onicecandidate = (event) => {
    event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
  };
  // create offer

  const offerdescription = await pc.createOffer();
  await pc.setLocalDescription(offerdescription);

  // session description protocall

  const offer = {
    sdp: offerdescription.sdp,
    type: offerdescription.type,
  };

  // the sdp contains special informations

  await setDoc(callDoc, { offer });


  // we wait our database to any change and if there is we updtae in the peer connection 
  onSnapshot(callDoc, (snapshot)=>{
    const data=snapshot.data()
    if(!pc.currentRemoteDescription && data.answer){
      const answerDescription=new RTCSessionDescription(data.answer)
      pc.setRemoteDescription(answerDescription)
    }
  })

  // anny time the answercandidates in the db chnages  it tells which new doc is added we create a new ice candidate and add to the peer connection
  onSnapshot(answerCandidates, snapshot =>{
    snapshot.docChanges().forEach((change)=>{
      if(change.type=="added"){
        const candidate=new RTCIceCandidate(change.doc.data())
        pc.addIceCandidate(candidate)
      }
    })
    })
});

// answering a call is same as that of reciving the call
pc.ontrack = (event) => {
  console.log("🔁 Received remote track:", event.streams[0]);

  event.streams[0].getTracks().forEach((track) => {
    remotestream.addTrack(track);
  });

  if (!remoteVideo.srcObject) {
    remoteVideo.srcObject = remotestream;
    remoteVideo.play().catch((e) => console.log("Remote play error", e));
  }
};
JoinCallButton.addEventListener("click", async () => {
  remoteVideo.srcObject=remotestream
  const callId = InputCode.value;
  const callDoc = doc(db, "calls", callId); // ✅ correct way
  const answerCandidates = collection(callDoc, "answercandidates");
  const offerCandidates = collection(callDoc, "offerCandidates");

  pc.onicecandidate = (event) => {
    event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
  };

  const callData = (await getDoc(callDoc)).data();
  console.log(callData); // ✅ should no longer be undefined

  const offerdescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerdescription));

  const answerDescription = await pc.createAnswer();
  await pc.setLocalDescription(answerDescription);

  const answer = {
    sdp: answerDescription.sdp,
    type: answerDescription.type,
  };

  await updateDoc(callDoc, { answer });

  onSnapshot(offerCandidates, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      let data=change.doc.data()
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
});


