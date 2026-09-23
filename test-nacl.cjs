const nacl = require('tweetnacl');
const { encodeBase64, decodeBase64, decodeUTF8, encodeUTF8 } = require('tweetnacl-util');

const alice = nacl.box.keyPair();
const bob = nacl.box.keyPair();

// Alice computes shared secret
const sharedAlice = nacl.box.before(bob.publicKey, alice.secretKey);
const sharedAliceB64 = encodeBase64(sharedAlice);

// Bob computes shared secret
const sharedBob = nacl.box.before(alice.publicKey, bob.secretKey);
const sharedBobB64 = encodeBase64(sharedBob);

console.log("Are shared secrets equal?", sharedAliceB64 === sharedBobB64);

// Alice encrypts message for Bob
const message = "Hello Bob!";
const nonce = nacl.randomBytes(24);
const nonceB64 = encodeBase64(nonce);

const encrypted = nacl.box.after(decodeUTF8(message), nonce, decodeBase64(sharedAliceB64));
const encryptedB64 = encodeBase64(encrypted);

// Alice decrypts her OWN message (this is what's failing in the UI!)
const decryptedByAlice = nacl.box.open.after(decodeBase64(encryptedB64), decodeBase64(nonceB64), decodeBase64(sharedAliceB64));

if (!decryptedByAlice) {
    console.log("Alice failed to decrypt her own message!");
} else {
    console.log("Alice decrypted her own message:", encodeUTF8(decryptedByAlice));
}

// Bob decrypts message
const decryptedByBob = nacl.box.open.after(decodeBase64(encryptedB64), decodeBase64(nonceB64), decodeBase64(sharedBobB64));

if (!decryptedByBob) {
    console.log("Bob failed to decrypt!");
} else {
    console.log("Bob decrypted:", encodeUTF8(decryptedByBob));
}
