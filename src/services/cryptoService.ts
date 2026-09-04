import nacl from 'tweetnacl';
import { decodeUTF8, encodeUTF8, encodeBase64, decodeBase64 } from 'tweetnacl-util';

class CryptoService {
  /**
   * Generate keypair for user (X25519)
   */
  public generateKeyPair() {
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: encodeBase64(keyPair.publicKey),
      privateKey: encodeBase64(keyPair.secretKey)
    };
  }

  /**
   * Encrypt message for transmission using shared secret
   */
  public encryptMessage(message: string, sharedSecret: string) {
    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.box.after(
      decodeUTF8(message),
      nonce,
      decodeBase64(sharedSecret)
    );

    return {
      ciphertext: encodeBase64(encrypted),
      nonce: encodeBase64(nonce)
    };
  }

  /**
   * Decrypt received message
   */
  public decryptMessage(encryptedBase64: string, nonceBase64: string, sharedSecretBase64: string) {
    const decrypted = nacl.box.open.after(
      decodeBase64(encryptedBase64),
      decodeBase64(nonceBase64),
      decodeBase64(sharedSecretBase64)
    );

    if (!decrypted) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }

    return encodeUTF8(decrypted);
  }

  /**
   * ECDH key agreement
   */
  public computeSharedSecret(theirPublicKey: string, myPrivateKey: string) {
    const shared = nacl.box.before(
      decodeBase64(theirPublicKey),
      decodeBase64(myPrivateKey)
    );
    return encodeBase64(shared);
  }

  /**
   * Encrypt private key for local storage using user's password
   */
  public encryptPrivateKey(privateKey: string, password: string) {
    const salt = nacl.randomBytes(16);
    const key = nacl.hash(
      decodeUTF8(password + encodeBase64(salt))
    ).slice(0, 32);

    const nonce = nacl.randomBytes(24);
    const encrypted = nacl.secretbox(
      decodeUTF8(privateKey),
      nonce,
      key
    );

    return {
      ciphertext: encodeBase64(encrypted),
      nonce: encodeBase64(nonce),
      salt: encodeBase64(salt)
    };
  }

  /**
   * Decrypt private key from local storage
   */
  public decryptPrivateKey(encrypted: { ciphertext: string; nonce: string; salt: string }, password: string) {
    const salt = decodeBase64(encrypted.salt);
    const key = nacl.hash(
      decodeUTF8(password + encodeBase64(salt))
    ).slice(0, 32);

    const decrypted = nacl.secretbox.open(
      decodeBase64(encrypted.ciphertext),
      decodeBase64(encrypted.nonce),
      key
    );

    if (!decrypted) {
      throw new Error('Decryption failed - wrong password');
    }

    return encodeUTF8(decrypted);
  }
}

export default new CryptoService();
