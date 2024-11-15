# zypher-test
Code to test zypher shuffle verifier in js and rust sdk

# To test js code

Go to contracts directory
```
cd contracts
```

To install dependencies
```
npm i
```

To compile the contracts
```
npx hardhat compile
```

To run tests
```
npm test
```

# For rust 

Go to rusm wasm code
```
cd zshuffle-wasm
```

Build as wasm application
```
wasm-pack build
```

To run test
```
wasm-pack test --node
```

### Test reveal_card_with_snark

To test reveal_card_with_snark in bevy run below
```
cargo run -p bevy-test
```

To test reveal_card_with_snark in unit test run below
```
cargo run test_wasm -p zshuffle -- --nocapture
```

### Run reveal_card_with_snark as a service

```
cargo run -p shuffle-service
```
