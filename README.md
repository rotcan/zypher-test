# zypher-test
Code to test zypher shuffle verifier in js and rust sdk

# To test js code
cd contracts

To install dependencies
npm i

To compile the contracts
npx hardhat compile

To run tests
npm test

# For rust 
cd zshuffle-wasm

build
wasm-pack build

run test
wasm-pack test --node


# reveal_card_with_snark test

To test reveal_card_with_snark in bevy run below

cargo run -p bevy-test

To test reveal_card_with_snark in unit test run below

cargo run test_wasm -p zshuffle -- --nocapture
