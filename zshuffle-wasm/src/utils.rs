use ark_bn254::Fr;
use ark_ec::{AffineRepr, CurveGroup};
use ark_ed_on_bn254::{EdwardsAffine, EdwardsProjective, Fq};
use ark_ff::{BigInteger, PrimeField};
use ark_serialize::{Compress, Validate};
use rand_chacha::{
    rand_core::{CryptoRng, RngCore, SeedableRng},
    ChaChaRng,
};
use serde::{Deserialize, Serialize};
use std::fmt::Display;
use uzkge::{
    plonk::{constraint_system::TurboCS, indexer::PlonkProof},
    poly_commit::kzg_poly_commitment::KZGCommitmentSchemeBN254,
};
use wasm_bindgen::prelude::*;

#[inline(always)]
pub(crate) fn error_to_jsvalue<T: Display>(e: T) -> JsValue {
    JsValue::from_str(&e.to_string())
}

pub fn default_prng() -> impl RngCore + CryptoRng {
    //ChaChaRng::from_entropy()
    ChaChaRng::seed_from_u64(1u64)
}

#[allow(non_snake_case)]
#[derive(Serialize, Deserialize)]
pub struct BigNumber {
    _isBigNumber: bool,
    _hex: String,
}

pub fn hex_to_scalar<F: PrimeField>(hex: &str) -> Result<F, JsValue> {
    let hex = hex.trim_start_matches("0x");
    let bytes = hex::decode(hex).map_err(error_to_jsvalue)?;
    if bytes.len() != 32 {
        return Err(error_to_jsvalue("Bytes length not 32"));
    }
    Ok(F::from_be_bytes_mod_order(&bytes))
}

pub fn scalar_to_hex<F: PrimeField>(scalar: &F, with_start: bool) -> String {
    let bytes = scalar.into_bigint().to_bytes_be();
    let s = hex::encode(&bytes);
    if with_start {
        format!("0x{}", s)
    } else {
        s
    }
}

pub fn hex_to_point<G: CurveGroup>(hex: &str) -> Result<G, JsValue> {
    let hex = hex.trim_start_matches("0x");
    let bytes = hex::decode(hex).map_err(error_to_jsvalue)?;
    G::deserialize_with_mode(bytes.as_slice(), Compress::Yes, Validate::Yes)
        .map_err(error_to_jsvalue)
}

pub fn point_to_hex<G: CurveGroup>(point: &G, with_start: bool) -> String {
    let mut bytes = Vec::new();
    point
        .serialize_with_mode(&mut bytes, Compress::Yes)
        .unwrap();
    let s = hex::encode(&bytes);
    if with_start {
        format!("0x{}", s)
    } else {
        s
    }
}

pub fn point_to_uncompress<F: PrimeField, G: CurveGroup<BaseField = F>>(
    point: &G,
    with_start: bool,
) -> (String, String) {
    let affine = G::Affine::from(*point);
    let (x, y) = affine.xy().unwrap();
    let x_bytes = x.into_bigint().to_bytes_be();
    let y_bytes = y.into_bigint().to_bytes_be();
    let x = hex::encode(&x_bytes);
    let y = hex::encode(&y_bytes);

    if with_start {
        (format!("0x{}", x), format!("0x{}", y))
    } else {
        (x, y)
    }
}

pub fn uncompress_to_point(x_str: &str, y_str: &str) -> Result<EdwardsProjective, JsValue> {
    let x_hex = x_str.trim_start_matches("0x");
    let y_hex = y_str.trim_start_matches("0x");
    let x_bytes = hex::decode(x_hex).map_err(error_to_jsvalue)?;
    let y_bytes = hex::decode(y_hex).map_err(error_to_jsvalue)?;

    let x = Fq::from_be_bytes_mod_order(&x_bytes);
    let y = Fq::from_be_bytes_mod_order(&y_bytes);
    let affine = EdwardsAffine::new(x, y);

    Ok(affine.into())
}

pub fn shuffle_proof_from_hex(s: &str) -> Result<PlonkProof<KZGCommitmentSchemeBN254>, JsValue> {
    let hex = s.trim_start_matches("0x");
    let bytes = hex::decode(hex).map_err(error_to_jsvalue)?;
    PlonkProof::<KZGCommitmentSchemeBN254>::from_bytes_be::<TurboCS<Fr>>(&bytes)
        .map_err(error_to_jsvalue)
}

pub fn shuffle_proof_to_hex(proof: &PlonkProof<KZGCommitmentSchemeBN254>) -> String {
    let bytes = proof.to_bytes_be();
    format!("0x{}", hex::encode(bytes))
}
