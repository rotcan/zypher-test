# zypher-test
Code to test zypher shuffle verifier in js and rust sdk

To test js code
cd contracts
# to install dependencies
npm i
# to compile the contracts
npx hardhat compile
# to run tests
npm test

For rust 
cd zshuffle-wasm
# build
wasm-pack build
# run test
wasm-pack test --node
