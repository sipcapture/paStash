# @hyperswarm/hypersign

Utility methods related to public key cryptography to be used with distributed mutable storage.

```
npm install @hyperswarm/hypersign
```

## API

#### `const { keypair, salt, sign, signable } = hypersign()`

Call the exported function to get hypersign instance.

There is also a class `hypersign.HyperSign` which can be
extended.

#### `keypair()`

Use this method to generate an assymetric keypair.
Returns an object with `{publicKey, secretKey}`. `publicKey` holds a public key buffer, `secretKey` holds a private key buffer.

#### `salt([str, ]size = 32)`

Utility method for creating a random or hashed salt value.

If called with a string the string will be hashed, to a
generic hash of `size` length.

If called without any inputs, or with a number, random 
butes of `size` length will be

#### `sign(value, options)`

Utility method which can be used to create a `sig`.

Options:

* `keypair` – REQUIRED, use `keypair` to generate this.
* `salt` - OPTIONAL - default `undefined`, a buffer >= 16 and <= 64 bytes. If supplied it will salt the signature used to verify mutable values.
* `seq` - OPTIONAL - default `0`. The sequence number of the value.

#### `signable(value, options)`

Utility method which returns the exact buffer that would be signed in by `sign`. This is only needed when using a salt, otherwise it will return the same `value` passed in. This method is to facilitate out-of-band signing (e.g. hardware signing), do not pass the returned signable value into `sign`, it already uses `signable`.
If you need to sign a value that has already been passed 
through `signable`, use `cryptoSign`.

Options:

* `salt` - OPTIONAL - default `undefined`, a buffer >= 16 and <= 64 bytes. If supplied it will salt the signature used to verify mutable values.
* `seq` - OPTIONAL - default `0`. The sequence number of the value.

#### `cryptoSign(msg, keypair)`

Utility method which can be used to create a signature using the `crypto_sign_detached` Sodium method. This only needs to be used 
when you *do not* need to apply encoding to `value`, `salt` and `seq`(e.g. if value and options have already been passed to `signable`).

Options:

* `keypair` – REQUIRED, use `keypair` to generate this.
* `salt` - OPTIONAL - default `undefined`, a buffer >= 16 and <= 64 bytes. If supplied it will salt the signature used to verify mutable values.
* `seq` - OPTIONAL - default `0`. The sequence number of the value.

## License

MIT
