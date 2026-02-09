mod poseidon;
mod pedersen;

fn hash_to_field<N>(input: [Field; N]) -> Field {
    pedersen::hash(input)
}
