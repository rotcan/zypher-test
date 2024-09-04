use std::collections::HashMap;
use uzkge::{
    gen_params::{ProverParams, VerifierParams},
};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use crate::gen_params::{gen_shuffle_prover_params,params::refresh_prover_params_public_key};
use crate::error::ShuffleError;
use crate::utils::{default_prng,
    point_to_uncompress,hex_to_point,masked_card_serialize,masked_card_deserialize,hex_to_scalar,
    index_to_point,point_to_index,shuffle_proof_to_hex,shuffle_proof_from_hex,scalar_to_hex,uncompress_to_point,
    MaskedCardWithProof,MaskedCard,ShuffledCardsWithProof,ShuffleResult,RevealedCardWithSnarkProof,RevealedCardWithProof,};
use std::fmt::Display;
use crate::card_maps::CARD_MAPS;
use ark_ed_on_bn254::{EdwardsAffine, EdwardsProjective, Fq, Fr};
use ark_ff::{BigInteger, One, PrimeField};
use crate::{
    mask::mask,
    build_cs::{prove_shuffle, verify_shuffle},
    keygen::{aggregate_keys as core_aggregate_keys, Keypair as CoreKeypair},
    reveal::*,
    reveal_with_snark::RevealCircuit,
    Groth16,ProvingKey,gen_params::load_groth16_pk,SNARK
};
use ark_ec::AffineRepr;

static PARAMS: Lazy<Mutex<HashMap<usize, ProverParams>>> = Lazy::new(|| {
    let m = HashMap::new();
    Mutex::new(m)
});

const GROTH16_N: usize = 52;

static GROTH16_PARAMS: Lazy<Mutex<HashMap<usize, ProvingKey<ark_bn254::Bn254>>>> =
    Lazy::new(|| {
        let m = HashMap::new();
        Mutex::new(m)
    });



pub(crate) fn wasm_error_value<T: Display>(e: T) -> ShuffleError {
    ShuffleError::WasmError(e.to_string())
}

pub fn init_prover_key(num: i32)->ShuffleResult<()> {
    let n = num as usize;

    let mut params = PARAMS.lock().unwrap();
    if params.get(&n).is_none() {
        let pp = gen_shuffle_prover_params(n)
            .map_err(wasm_error_value)?;
        params.insert(n, pp);
    }
    drop(params);
    Ok(())
}

pub fn refresh_joint_key(joint: String, num: i32) -> ShuffleResult<Vec<String>> {
    let joint_pk = hex_to_point(&joint)?;
    let n = num as usize;

    let mut params = PARAMS.lock().unwrap();
    let prover_params = if let Some(param) = params.get_mut(&n) {
        param
    } else {
        let pp = gen_shuffle_prover_params(n)
            .map_err(wasm_error_value)
            .unwrap();
        params.insert(n, pp);
        params.get_mut(&n).unwrap()
    };
    let pkc =
        refresh_prover_params_public_key(prover_params, &joint_pk).map_err(wasm_error_value)?;
    drop(params);

    let mut pkc_string: Vec<_> = vec![];
    for p in pkc {
        let (x, y) = point_to_uncompress(&p, true);
        pkc_string.push(x);
        pkc_string.push(y);
    }
    Ok(pkc_string)
}

pub fn init_masked_cards(joint: String, num: i32) -> ShuffleResult<Vec<MaskedCardWithProof>> {
    if CARD_MAPS.len() < num as usize {
        return Err(wasm_error_value("The number of cards exceeds the maximum"));
    }

    let mut prng = default_prng();
    let joint_pk = hex_to_point(&joint)?;

    let mut deck = vec![];
    for n in 0..num {
        let point = index_to_point(n);

        let (masked_card, masked_proof) =
            mask(&mut prng, &joint_pk, &point, &Fr::one()).map_err(wasm_error_value)?;

        deck.push(MaskedCardWithProof {
            card: masked_card_serialize(&masked_card),
            proof: format!(
                "0x{}",
                hex::encode(&bincode::serialize(&masked_proof).map_err(wasm_error_value)?)
            ),
        });
    }

    Ok(deck)
}

pub fn shuffle_cards(joint: String, deck: Vec<MaskedCard>) -> ShuffleResult<ShuffledCardsWithProof> {
    let n = deck.len();

    let mut prng = default_prng();
    let joint_pk = hex_to_point(&joint)?;

    let mut masked_deck = vec![];
    for card in deck {
        masked_deck.push(masked_card_deserialize(&card)?);
    }

    let params = PARAMS.lock().unwrap();
    let prover_params = params
        .get(&n)
        .expect("Missing PARAMS, need init & refresh pk");

    let (shuffled_proof, new_deck) =
        prove_shuffle(&mut prng, &joint_pk, &masked_deck, &prover_params)
            .map_err(wasm_error_value)?;
    drop(params);

    let masked_cards: Vec<_> = new_deck
        .iter()
        .map(|card| masked_card_serialize(&card))
        .collect();

    let ret = ShuffledCardsWithProof {
        cards: masked_cards,
        proof: shuffle_proof_to_hex(&shuffled_proof),
    };

    Ok(ret)
}

pub fn verify_shuffled_cards(
    deck1: Vec<MaskedCard>,
    deck2: Vec<MaskedCard>,
    proof: String,
) -> ShuffleResult<bool> {

    let n = deck1.len();
    let mut masked_deck1 = vec![];
    for card in deck1 {
        masked_deck1.push(masked_card_deserialize(&card)?);
    }
    let mut masked_deck2 = vec![];
    for card in deck2 {
        masked_deck2.push(masked_card_deserialize(&card)?);
    }
    let shuffled_proof = shuffle_proof_from_hex(&proof)?;

    let params = PARAMS.lock().unwrap();
    let prover_params = params
        .get(&n)
        .expect("Missing PARAMS, need init & refresh pk");
    let verifier_params = VerifierParams::from(prover_params);

    Ok(verify_shuffle(
        &verifier_params,
        &masked_deck1,
        &masked_deck2,
        &shuffled_proof,
    )
    .is_ok())
}

pub fn init_reveal_key() {
    let mut params = GROTH16_PARAMS.lock().unwrap();
    if params.get(&GROTH16_N).is_none() {
        let pp = load_groth16_pk(GROTH16_N).map_err(wasm_error_value).unwrap();
        params.insert(GROTH16_N, pp);
    }
    drop(params);
}

pub fn reveal_card(sk: String, card: MaskedCard) -> ShuffleResult<RevealedCardWithProof> {

    let mut prng = default_prng();
    let keypair = CoreKeypair::from_secret(hex_to_scalar(&sk)?);
    let masked = masked_card_deserialize(&card)?;

    let (reveal_card, reveal_proof) =
        reveal(&mut prng, &keypair, &masked).map_err(wasm_error_value)?;

    let ret = RevealedCardWithProof {
        card: point_to_uncompress(&reveal_card, true),
        proof: format!("0x{}", hex::encode(&reveal_proof.to_uncompress())),
    };

    Ok(ret)
}

/// compute masked to revealed card with a snark proof
pub fn reveal_card_with_snark(sk: String, card: MaskedCard) -> ShuffleResult<RevealedCardWithSnarkProof> {
    
    let mut prng = default_prng();
    let keypair = CoreKeypair::from_secret(hex_to_scalar(&sk)?);
    let masked = masked_card_deserialize(&card)?;

    let reveal_card = masked.e1 * keypair.secret;

    let params = GROTH16_PARAMS.lock().unwrap();
    let prover_params = params
        .get(&GROTH16_N)
        .expect("Missing PARAMS, need init & refresh pk");

    let circuit = RevealCircuit::new(&keypair.secret, &masked, &reveal_card);
    let proof = Groth16::<ark_bn254::Bn254>::prove(&prover_params, circuit, &mut prng).unwrap();
    drop(params);

    let a = proof.a.xy().unwrap();
    let b = proof.b.xy().unwrap();
    let c = proof.c.xy().unwrap();

    let snark_proof = vec![
        scalar_to_hex(&a.0, true),
        scalar_to_hex(&a.1, true),
        scalar_to_hex(&b.0.c1, true),
        scalar_to_hex(&b.0.c0, true),
        scalar_to_hex(&b.1.c1, true),
        scalar_to_hex(&b.1.c0, true),
        scalar_to_hex(&c.0, true),
        scalar_to_hex(&c.1, true),
    ];

    let ret = RevealedCardWithSnarkProof {
        card: point_to_uncompress(&reveal_card, true),
        snark_proof,
    };

    Ok(ret)
}

pub fn unmask_card(sk: String, card: MaskedCard, reveals:  Vec<(String, String)>) -> ShuffleResult<i32> {
    
    let mut prng = default_prng();
    let keypair = CoreKeypair::from_secret(hex_to_scalar(&sk)?);
    let masked = masked_card_deserialize(&card)?;

    let mut reveal_cards = vec![];
    for reveal in reveals {
        reveal_cards.push(uncompress_to_point(&reveal.0, &reveal.1)?);
    }

    let (reveal_card, _proof) = reveal(&mut prng, &keypair, &masked).map_err(wasm_error_value)?;
    reveal_cards.push(reveal_card);

    let unmasked_card = unmask(&masked, &reveal_cards).map_err(wasm_error_value)?;
    point_to_index(unmasked_card)
}