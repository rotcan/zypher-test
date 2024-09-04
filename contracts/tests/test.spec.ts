import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { TestZypher } from "../typechain-types/contracts/TestZypher";
import { expect } from "chai";
import * as hre from "hardhat";
import { BigNumberish, ContractTransactionResponse } from "ethers";
import {anyValue} from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import * as SE from '@zypher-game/secret-engine';
import { RevealVerifier, ShuffleService } from "../typechain-types";

const deckSize=20;
type Contract<T> = T & { deploymentTransaction(): ContractTransactionResponse; }; 

describe('init',()=>{
    let TestZypherMock: Contract<TestZypher>;
    let MockRevealVerifier: Contract<RevealVerifier>;
    let MockShuffleVerifier:Contract<ShuffleService>;
    
    async function createMockVerifiers(){
        const deck_num = deckSize;
        const RevealVerifier=await hre.ethers.getContractFactory('RevealVerifier');
        MockRevealVerifier=await RevealVerifier.deploy();

        const VerifierKeyExtra1_20=await hre.ethers.getContractFactory("VerifierKeyExtra1_20");
        const verifierKeyExtra1_20=await VerifierKeyExtra1_20.deploy();

        const VerifierKeyExtra2_20=await hre.ethers.getContractFactory("VerifierKeyExtra2_20");
        const verifierKeyExtra2_20=await VerifierKeyExtra2_20.deploy();
        
        const ShuffleVerifier=await hre.ethers.getContractFactory('ShuffleService');
        MockShuffleVerifier=await ShuffleVerifier.deploy(await verifierKeyExtra1_20.getAddress(),
            await verifierKeyExtra2_20.getAddress(),deck_num);

        //return {MockRevealVerifier,MockShuffleVerifier};
    }

    async function loadZypher() {
        let Game=await hre.ethers.getContractFactory("TestZypher");
        TestZypherMock=await Game.deploy((await MockShuffleVerifier.getAddress()),(await MockRevealVerifier.getAddress()));
    }

    beforeEach(async()=>{
        await createMockVerifiers();
        await loadZypher();
    })

    it('Zypher JS test',async()=>{
        const [_owner,p1,p2]=await hre.ethers.getSigners();
        const keys=[{ 
            sk: "0x020b31a672b203b71241031c8ea5e5a4ef133c57bcde822ac514e8a1c7f89124", 
            pk: "0xada2d401ec3113060a049b5472550965f59423eaaeec3133dd33628e5df50491", 
            pkxy: ["0x27f9bc87a7fe674c14532699864907156753a8271a6e97b8f8b99a474ad2afdd",
                 "0x1104f55d8e6233dd3331ecaeea2394f565095572549b040a061331ec01d4a2ad"] },
                 { sk: "0x02d75fed474808cbacf1ff1e2455a30779839cfb32cd79e2020aa603094b80b7", 
                    pk: "0x52bd82819071b9b913aacfccc6657e5226d1aebd5e5ec4fbdea0b6f5bb2bdf12", 
                    pkxy: ["0x0fc2c87764783cdc883744c16712654ce3d0fccbea70c9ce379a8bc7f412f006", 
                        "0x12df2bbbf5b6a0defbc45e5ebdaed126527e65c6cccfaa13b9b971908182bd52"] }

        ];

        await TestZypherMock.connect(p1).initKey({x: keys[0].pkxy[0], y: keys[0].pkxy[1]},
            {x: keys[1].pkxy[0], y: keys[1].pkxy[1]})

        const jointKey = await TestZypherMock.jointkey()
            .then(m => m.map(bn => hre.ethers.toBeHex(bn)))
            .then(SE.public_compress);
        expect(jointKey).eq("0x9723835eb88d3c9e76f6d0c1295724e4f76fd0762568dee9a79394760510659d");

        SE.init_prover_key(deckSize)
        const pkc = SE.refresh_joint_key(jointKey, deckSize)
        
        await TestZypherMock.connect(p1).setPkc(pkc);

        
        const maskedCards = SE.init_masked_cards(jointKey, deckSize)
                              .map(({ card }:{card:any}) => card)
        
        const {
          cards: shuffledCards,
          proof,
        } = SE.shuffle_cards(jointKey, maskedCards)

        await TestZypherMock.shuffle(maskedCards,shuffledCards,proof);
    });

    it('Zypher Rust test',async()=>{
        const [_owner,p1,p2]=await hre.ethers.getSigners();
        const keys=[{ 
            sk: "0x020b31a672b203b71241031c8ea5e5a4ef133c57bcde822ac514e8a1c7f89124", 
            pk: "0xada2d401ec3113060a049b5472550965f59423eaaeec3133dd33628e5df50491", 
            pkxy: ["0x27f9bc87a7fe674c14532699864907156753a8271a6e97b8f8b99a474ad2afdd",
                 "0x1104f55d8e6233dd3331ecaeea2394f565095572549b040a061331ec01d4a2ad"] },
                 { sk: "0x02d75fed474808cbacf1ff1e2455a30779839cfb32cd79e2020aa603094b80b7", 
                    pk: "0x52bd82819071b9b913aacfccc6657e5226d1aebd5e5ec4fbdea0b6f5bb2bdf12", 
                    pkxy: ["0x0fc2c87764783cdc883744c16712654ce3d0fccbea70c9ce379a8bc7f412f006", 
                        "0x12df2bbbf5b6a0defbc45e5ebdaed126527e65c6cccfaa13b9b971908182bd52"] }

        ];

        await TestZypherMock.connect(p1).initKey({x: keys[0].pkxy[0], y: keys[0].pkxy[1]},
            {x: keys[1].pkxy[0], y: keys[1].pkxy[1]})

        const jointKey = await TestZypherMock.jointkey()
            .then(m => m.map(bn => hre.ethers.toBeHex(bn)))
            .then(SE.public_compress);
        const ref_joint_pk="0x9723835eb88d3c9e76f6d0c1295724e4f76fd0762568dee9a79394760510659d";
        
        expect(jointKey).eq(ref_joint_pk);

        SE.init_prover_key(deckSize)
        const pkc = SE.refresh_joint_key(jointKey, deckSize)
        
        await TestZypherMock.connect(p1).setPkc(pkc);

        const maskedCards = SE.init_masked_cards(jointKey, deckSize)
        .map(({ card }:{card:any}) => card)
        
        let ref_pkc=["0x2c28d5485bf5560982984967120f5d72994bab7d4515f8bee200139bc7f02774",
            "0x19296a4ba4870d47c10c52180d9c16eb6c866647f4b3cafda63955e64c0727b0",
            "0x1ef48b30d3b4ac4240a38f05dd8f4f46d300497561227238448e286fcf32aef6",
            "0x2ba9f581b493ad946808cfa8bfb87fa5f1e15c83a73009a01d70e1ebe345b148",
            "0x1728be2b9b1fa266c3cfb0b788fbe505781930c0e091ef78199b41d478259aa8",
            "0x07289b78c418c690c6d17d8259d0616f0e1e6158f74251f25062afb6ef89720f",
            "0x1849f699207034d3638a276b1ca79317a363aa43616f1ad4902aafd9ea8cebb4",
            "0x1b4bada6fad626ba90f889e80646e892dfde24178d0f0193337793bc17876aa5",
            "0x04cab23a63f618e2e6c06f7b60c3e69f65ccfbba544abc96402419983331e150",
            "0x00ffb0631a4cda988285aeb248ef71253e906f6301e5ccd697da33549785a989",
            "0x119ec51c3af0815592bd785f7377fee828ca752141307970c9115952f8d27fdb",
            "0x12f0058ad100d1e2c9e367c7aa51f693a6a273c44f3ff0606a8485d45d41d694",
            "0x01493616905dc7e5d30c4d594d04818da1ef73d8ad3b3b26bd750d48b03d1842",
            "0x2fc3b3f1a6faa0b5e50f6e5f8f1105ec17d6576af28ed31dcd280bb76ce6cf92",
            "0x01542cea6ad2259fecf0e7f6a9d50c55f05a926e00f138766439eaac9e97298b",
            "0x142b74a00df40ccf1c438b4cfdd64177b37f965dd52ebbf657708741888197e7",
            "0x2ec659fdf850de3062adc2d1cad5186b2d5c3dcef14693aaa2659ca6fd40b051",
            "0x08f54c229ca72449e4580ffc3a1a53414e9b361d6791605c21f39711a9c37921",
            "0x18c1ef8b1f2ac350cc12c7e6bc0a0d6e1f87992640e4facef6ba2fb4bed5aa75",
            "0x2408c75b89fe8ca84807565c202826bffe2fc816a93c03a3f67468643b7fcfa6",
            "0x1e3f5566634171266f306722824e2191cf425812abc9ceeefe9958d0d452d6df",
            "0x00df50e9ba8b3183f6049b2ae30dbbfefbbe112083315fec960c44c52fdf0fb2",
            "0x262599896f9ef09222892c46d3bcdab79a71f5b79dedd95c007a9fab94861a6a",
            "0x28e008842aa82ea15a37e59184a8e2dca06f40dd45c87c0c4e42c0320b3931f3"];
        expect(JSON.stringify(pkc)).eq(JSON.stringify(ref_pkc));
            
        const ref_shuffled_deck=["0x0bbb65c1461f6b6622f4fcc71f24eca08df3789e4318c1d1f23628a73839d852",
            "0x2bac4f082c8e1482be425cc89eaf2d347b51aded2901937e6e7bfd0131b14ee2",
            "0x0139327aac5ec9067c9509587200e581a7b86c3a0338607b62ee8853bf2ee48f",
            "0x20057633ca7fab6c6834ec0d5bf96f8149c061027ecf0dee6c81777a0076c3a9",
            "0x304da732eed1869ff95fd5f1b363765efc7d39cf4e4a1228ad72e149f5a79186",
            "0x0bceb57d1d1a94de2234b6ef3045ea3317a1a08ddfd2bbc92eab8c52c4fa37ac",
            "0x2ebfa8ac9898e2f354a1a5c22d2d035f1225602e87b038bfc7b7cfd77c92471c",
            "0x11375dec7c72dd549b90ba7c7fd77d1bb13311b0e9c92892047d480f4caa40a8",
            "0x0bc01f107aacfbef7676c30a040bb2e6a60f869ec72b2489d9b0f107917064e0",
            "0x0d9ee960a6fe0b523b4d22914ed20239c5770adf8fc08a955e4f180bc18c15a7",
            "0x235bd93cf28ddab8dd7b4226b991eab52a83d277107196ec1fa4bce930de2fb4",
            "0x21de69e13d67ced782992627914d4b101dad82c71acb32b709bd4f7c04705655",
            "0x1ef6c5b37f92f9532761f730d141ba96dcd3335c1cc7c0a1c0c9a8d1c6c0e4e8",
            "0x0df8584401494ba07df1635ae6b6f2194177b2d3247afca0cd689664d50e0fef",
            "0x2fa59d94eea0c8f80d41a0e58da0a533a2e0bf7f4f80d3c286b10ae75184f254",
            "0x2249651ace591ced0c05d43fb23b47ec1e815efb4e2af0ca1168ae1f4ca70a60",
            "0x00b78a3c52bf2d3b9490e9079fa82a4b0c69a004cf45942acd3d989831b98e00",
            "0x1a357d47903c2c50dc122e1d24895a66542961377f358c321d84ebcddcae7d64",
            "0x239690fed420da33a1d406ccdbd61d3f5b7452a480f2d2bf5356c2595bbc1aeb",
            "0x0a8915c1237206ec44f931969a892634918da36311826762257c180d3bd227f2",
            "0x22427464b32549a9722df18ca886ff82569980f188a97c4e886ad7dec0b987e1",
            "0x1b428e2b1f2198e028a373d92b6895344f2f11b190b74f548073a7e2fa261268",
            "0x1d62493c68c7bc18dce4c470bbd1be14e025c77cef9a58f66a4d4078adede6a8",
            "0x00526cce1e1986807c328a20415a261d312e535315dc760528c7b8756d8f1c9c",
            "0x1cdba6560c82b7dbea0fd541b6ba5e700e1d9a9dce1606cafcbd33942b56e51d",
            "0x101c5b7ac7c450513e7c23f71d0aa3077694a1bf541d5d4dc3c2fdfe88b640de",
            "0x0451e266eb162009f1c11bd5a410c949d1023fc9691da62ac7dc7e1c2bdce0b8",
            "0x0c006b1395809d68235d84b98e31a9c78250df11a8b333c7d880688781b4d498",
            "0x266cc4e1ecf64290a7a5d777929c9d66119dbf794816227e21ca45091cd7cd0f",
            "0x2b52aa3f24c0a63bac896a410b30ed467aba3ab5973a2b07be86ee9499eb11aa",
            "0x185b7cab7030c7f4875ab08eea6117573925b3499735ebd36c3ec8bf04850b6d",
            "0x048d1e21194c9c04f5a88e3779170dfd306553ed5ab37ee1df29d77b60914d1d",
            "0x29240eb7ed12b6ada27e33472183e8e09f796d7bdc6b680216481674c00d259b",
            "0x1ee0dbc06f431daff0fd188dcc3ef6c0388260e33222290fc44ebfb94fcba0a9",
            "0x29c0099dccb2d72a22b45405979066e5a91de6947e60e13b9d447a418eb87218",
            "0x031f3accb21ab8a6930e475488f4b127b00f6f1d7e67883a5634c3fc4ea3c42f",
            "0x28051ddf82042e67732359c13d9c1ac500b124715a5ff93a113647855d7d58cb",
            "0x10d12508535e8845a1f244c17a9670ba23ea9cd4b5231302d39a40c5e39055f6",
            "0x009fb1b19631b91b864a8bb28457873e59734e38656322be62292536b0fd79e5",
            "0x19c15243cee1fe4b9f3f90c7664eba91fdb85c05dc575d1f2dd660125e02ba8d",
            "0x151fa31beeddeb8f7e3eb6b402163d6fdd6be19584e0ed295a67be80b53a2410",
            "0x3003d3764ae6672f8f6f138334a48948537c81996155b099b96f03b71b099e38",
            "0x1796ff4f29468899ad61ffb71312b2ec94302629c6cd9e7697da02c909f691ba",
            "0x29c0e7d597717777a6c71b6dcf3b7c8742cb2ba49cfae3046defd6613e4eb73d",
            "0x1291d56e01c1d6986ea325aaf27d893f186efed4f5f70b7878a70183c67a3277",
            "0x0ad878fadb06f6247208a957dfbd9ffc576d4606354a1268d7efb96392110ff4",
            "0x2ad163bd7db13e3203c4846aaa3d2547b7b4477b7c78f69b243b4f08c16b6e05",
            "0x2f6b450d03544b66387da53047bb6bc84865b8418611c714f69352425a3afd3d",
            "0x1811282d899defa0dfee53d0b6ecdf0d77359cf726e6dc8528aad0408721eb6a",
            "0x280b4b4edb75fbf27cf1323a092b11302a7e963891c98c9ece79b8d6f0665b81",
            "0x113418fde872b76e7b249e07e937c5145a8e179e82307fcfd9387cd88852657d",
            "0x03732a46df921828bf40da5b8c7352f2743edb151b6d46334672cf7733f82916",
            "0x0f7464c01c30a5db0090048cb8f60db104004d1af59677f62e9959583ee90f61",
            "0x23589543df39db0b077c7a9bde6d41225b17d42d57fa93218511bb2c0b511b89",
            "0x0c3903e6ce5b8123602671e396bfd4f28e2d6eff64ea95bbc3cf09b53808f32f",
            "0x009e05c0864050a6d9ef077f1a4bc22d1bc80d7793d08e016ef0313600dc1b02",
            "0x12aee7f86e669db42d03f136dd64cbff14ccb29d4469247a99d6bd896e017f37",
            "0x12f1b618aa475ccf7c7fa4b953973732a805352173cd280f37680c0bce1e01bc",
            "0x0393311fac257f212d145559d9de48517868caf420646ea35f896b1c6bb55939",
            "0x25ea6480917bedba39c332ed4428808bfadd485aa384ebf83fd3b726c69e61f8",
            "0x00aa39ec2abee1ec24482afb939dcd001f1bb06b2b0cce4fd7bd0e789004ae01",
            "0x22f2a336ec4b7f9b3d0790941fe4b0ab0b5690c3072bb82d03f06c62db2dfecf",
            "0x2e4afd0fc5a28a430fc230a7652df27e786a2d332cfae842f9985236c0b79ea6",
            "0x05890230503ce05296e1c5c7f04c59aa8fff7bc66933eda43e24abf97dfc4296",
            "0x0f690c28ba6b2c2cd1fef3e1a64da9eed3003c21fcf98137fb180393afe8e7c5",
            "0x24d980494e77cbbdb8b71d9f71f86375f3884dc53d59a966f3be7efa77b6967a",
            "0x2816c402eba2c216beb7266cdfc3c4a639900903db337e7afbf980ef8fb82041",
            "0x0d603b752f66aebba3f2a569e9751b6ce8d2668de33c30b9c128a3a5e0e282cf",
            "0x05466eb2934a1577d8e0d3509d6a15f77608ffff5a1de67bc64a6b941b58eb4e",
            "0x000f261c3b3a4b2a0d0a87698a0452409f6cce8076d1e829b3614d6567ee4fab",
            "0x2ebf4c514f0e069bf90d68b48cf3e272c6e072d19c586a89d32c8af617c62af2",
            "0x1412f1ae278303ac3dd760fe7eeeb10607b6912d578b32c806de4a2ee6853b57",
            "0x16b64521ba3292b3d66a8994a05807e1303818a43c09e1098ab303603f0005c5",
            "0x227c9f4ff745c91bee4edcbe9ef1b9b6929a10912f6a2c33ff7796edc733d1e1",
            "0x0b7159016cc2002ea578c0a9c67e0cb242626ad75712963e313924b28cd8d30e",
            "0x1a891ddcac79dfadeae290579f85ea6da9e6ed57fe1804df8df5ec1e60a72516",
            "0x034c8e87f3e82f482f82664b79f67678b02178bd8d85a3875698388841a9cf56",
            "0x0fb974b158713c5c805546eedebef393f34c0799eb873ccfda35d0fa37cf3191",
            "0x22f538b013569004dcac6fef2ea1f17568ee3215e089a174bd811e3a8242dfd6",
            "0x09d7c4286978eecffc71726de6f6829be024e9280d7aaf1b1cf2a9957ad5d90a"]
            
        const ref_masked_deck=["0x218ce9bf8e71ec0e86503b7c5bb6dc41a8555e2f831aa06baa50fa2fecce1cfa",
            "0x27290ca3bad842546c971f8aa3b13b84300fec5ea9d8d2045b055f2f4031abc9",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x22819234aa9c6645b6982a027eab08fdc736cc3ebd270ffc59e29a3ca85bb4a6",
            "0x257b39c39fd1b30cf4c72b5a549772e53f560c45c3dd8735bbe9d425c9913a6d",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x2070d8b05ef7e4360c7cd120e7b21aca02df363ff87eefb37b3718b2f73cf987",
            "0x1a0606f39e33eb502189ec1d87de6dc35a24b4b26ecccdcbf1d8fe1540d8e18f",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x01b489dcbaf3372c8b586ac3f9a1e366333dc158c53440116b3f7380a4aeb87a",
            "0x019dadf830f711e7b65aa6a8b059867188a959d7599becde5ffa5147738b8294",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x1245544e952faf04fddb969fcd5310a916bbe5fec9e925ef1b7a5d9efce743c6",
            "0x1c3d03003cdc88361800f6e0033e53157cac88bd99f52937e74a476671e54f4f",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x11c5bd3206781b352bf662197d273b6e921742f8f018400a6b55224dd3529e3e",
            "0x09c2d2981a44eadf340d34c38d04c0134af9c51593ca3836bd463e0ff8c9455f",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x25d0b32f3611bc80cd293fda04e398d7fe97cf08fffaa2dc1857ce7e54caa900",
            "0x08ca5c823686ae0e899a19f6a02ba9433b9aff14d38b6b2d2a4e2e77b35bb09a",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x03fea0d63e1b2638e629e4a62851358de6756ec2654929435a83ac79e27d9d76",
            "0x0f4057aa149c2789580ca13e13f58f5bc560401de0cf84fe40245797690dcb64",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x08c194c6edfa0e5817e2512ed9fa1f9a31176f33054c43a0f09c82921b277d11",
            "0x02cf1852c4d3c70254925809cc3b3e471352cae7cd7a02972a4fbc25e49ff8d2",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x2b76968337a76cd315ff36759c2afed4156079ce8d03bf8e1a99d56af60dfee4",
            "0x12804496f72a370a83a3c0e200c0406768a4865c6c966b1048831800b4bdfa04",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x163a252b384d0bc1c62ace71d7c98d833d0aa5596f152a90615a26a7a39ae3ec",
            "0x164ca5f144bbc192e71168dbc0619ec1f570634fdfb72b01c88039f75596f10d",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x07b06e605534b3e89ed492a5017a62eb5753c2d64357feb4118a8e057cb8c2ae",
            "0x1161d9cd4e7180afbf6c65add16bf1bc8cc3e3774d93341ddd265a2739e03fca",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x2be54ccd8a27e7196eafa05d387ad2748fc828aa7f8230668eb598b41d692a6e",
            "0x1733013b4152066f4a38b6c75484b7669c71418ca59f7ac32e9c1c393f3b3738",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x2b4ed7d39ae55cd435fda64709e2d6ce9a5d7d8519a2e6e6a8f71e80d83942b7",
            "0x2d9a5a442767f61165dad8677c89abaa167b35a67b0baa1f5b6a871aa97165ba",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x04aacf4835d4c2d46260ef14fa8539566eaf58e5d00c71b1b80fa5e3bc522976",
            "0x2c5746f4ba6c4dc80147c39e518dfeca2faab87182d194a541fb9942b285685f",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x12cfe6586c85accf57b0a4cc08fa5c9c307f71bdd6fac33b181292fde4f05395",
            "0x29d54126f5269094fb9f59e3e2ce5ea8c100af040a372a62f35d75c1f2105093",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x0c9ca759a8334bb3691b7d106e0a8dfef33d59e62d5dea7581ecef987b367ed5",
            "0x20c9b1fb4a0999d297372e401d0376909592433fec0c507250bd4dc68d5a2322",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x2aa4a6dd47dcef8ba03c5779761d13e89e261fa138f2251becf9e48cfd482a27",
            "0x24e6bfa0b8e7534f65c02d03e1c2cb0c07fcce8e6b938c0b559b076636f283a5",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x0e49c4014b9fb094c591c9f60b2c1353006ce06a044929307ed842c09f443d92",
            "0x102fd4ae1270abb425d492ea44bcae028ca21afba81fd58a1533e382f99d58a8",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f",
            "0x0e00e37a909c62c8202a8e730053c66078f0a95fa0c3561c5b1d3f16a0d6ddd6",
            "0x1fdb4022b40dd1c88c830c1268f1bffe2f09b07e09b8a6b8bac6f30d4bec45e0",
            "0x2b8cfd91b905cae31d41e7dedf4a927ee3bc429aad7e344d59d2810d82876c32",
            "0x2aaa6c24a758209e90aced1f10277b762a7c1115dbc0e16ac276fc2c671a861f"];
            
        const ref_proof="0x15891aac880c74f937aa70a36723a980b72bbede6d8331a0bc26f641a0de04531115e6f9d65695c7393698f1714abac584c57de57bffad368d505c822a281ba4227596fcbb4ae27b7af9e487dce3e3454128f8f6e7bb8ac13696af67d81964341537795f17f7e70e674c7a89fed99da977ad88f810a4f609318d14105ea7a615131adc0a9553a66291dac1549199169a36831475daa209f9477272d8ea5d71740b28ff18c2e0f3349491f9f0582033bd44e1791bca02aeb1e08aebb1d911df5b09c97db95a4871489c9ca4b30e083d4161b21b7ad24afa19aaaa81c692fdc50c03c12b7fda8245fcc44e7929715358db0ef4dea768de5bab0272f6d0317098b20672843381213993ad65bc83ed2638f03fb03bb6cee3596b5353368ed58ea23113b51d459cf815d465f4623780fb4125ca47fe6153be0a0dde13b190b937e1b2297fcb279598565a4c729b937d59b38083bf1b08fef0a57f6383f38a274ee8991a235a2de319f0fd8cb6dc2b4ac4d4ce00421381a90bb5406769e6f3ab6f801628775afa1db0d9fb732cd3b52522b635b3b663cdf2a822b555ba8dea66273d9a0b6c33af46a95f85326b48caad29922e7ccdd9984f02cf41e041e5ef37a392e20f67fd26f9119e29df76ad1a3d73301c00b42e3ea48bd928ab833f643e29f1051187cacfdcc35d1f461e7ef2ee5ed44ca35d704e349adbaef833af56a1cb92f7301bd9d884772e6922502ae1224b9c8225fa3c348793e68d03e2e054ab2bd6d3000a7c18b708cb752d49efa061d28ee158418742d5855fbec6a515d88a585b1a170c419d9e9ac9f22b9f4c71bc5532eb9c6f77f6ee9f7714a0a0e6f815fc12361455e132ba26f2dc245b8ec23219d0b547a7d38355e3acd8a1b51d2ad5c141c521a0ae723836ff1c132e4f070e3e418179d1b38bf42e6d2cadac6196ad8d3acd207117e9bf4d3da68c2151c968912306a326f0c437ad045ff704f2d34a3e2f120eb0139867eaae4b9c14628567f0d3925e249599f471b2220387ca275ddf09c712b0b1ac510b273127405273d2212b079bdf0c001d182205b4d27561dc9ef37311c26d31217fb77e43fa3d684735bf68162ec92d3c52dd80dba03f74cf0e66970ad415b1a968a57e71a61f6b5a7f8dded389656d2523cf10e2e5fd00692950182e189ba71ca4bbd128154dd86dc65e5cc812245a46b56063ac8e2423c041389d2b5b3adecbe8274b6724ba54c74d105138ea209fd1131b0125861b2c678cec76000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ee0fabae5212b28a86ed2cc5204d9a718cd99c1d8467fca87a4aa0f65f65c7404655dfb0e277630b9e769576543237b88b54a8a9a6e720fad05878b6034e7291c2f0091182f40cb4bd35ba023a5569b2bf52d2adc79c4ba431511c94117e2a2279cea6584cd77a4f5a39b41b048867a9888c3592dcad2102b19e7ea441c8ae11de4a78aae7277d8d105df89fd3e894bf68a15ea8e6c09ad92f39c9b6222e07b2c1ee1cdf9bb04346a293dfc12e00f02f5d52ca2f81cb7fcada60bcdc2d223b215c4dba953570872f7fd82e93443c23947de1e534ee8a2cc67c4baaec660186917067977b3185b04ca94670b59a9585f2b6e2a74f28231729d9c3d10c9ab4f9c125ff4eb965599a01494f4fd93c708e5e4e745f5370cc770fa7f1f32c18efc52062369cdc4da342eb2d29f982ea496ad9f78c0889e86ff3a8dd5cae512cf028e08b49369c73ac4bf0705737b37ed49dbba8efbd9bce8d37e6bacc0dd6062c7c605490faefa9866bbf770f1535fae0910126e8dcd383b701b0da3fc129a452bec0823389ae2a32b7df276ef5d8e90c8d60b2cccca48fed6b9d7bdc61b08a29b780cb0e9faa64c764a9e3a11de6e5f3c9aa221c06fe723f20ed2ca760a69fdc1f32f7328d59cfbdc84cfb9061bb8c0452307127c0a4f3b7e19eff060aa6df48e8e01ae1acf6f9bee75a0b492cca11eecde351aa6eb78247b6c19c997001d5e0fc02a1c2c0988835b25e325f11405b1d5099312c2df8edcad269d95f8e0117d2cf9182da3daeaab41cf23be26252a289a54892b7a3ecadc50ab3d8175af840637e6113cde42693544975e9f87da6a6f7cb30d9ff11b73be060332609568bb8a61662a52cbd8d8920ef0ba74b47d376c4a6d055e2ebf9907fae297f1404072b6d4c0072ee4e97cdd713a104a0fae53b188077d235f185d4a8c5eacc92ee48884679a";
            
        
        const shuffleCardsNew:[BigNumberish,BigNumberish,BigNumberish,BigNumberish,][]=[];
        const maskedCardsNew: [BigNumberish,BigNumberish,BigNumberish,BigNumberish,][]=[];
        for(var i=0;i<ref_shuffled_deck.length;i+=4){
            shuffleCardsNew.push([ref_shuffled_deck[i+0],
                ref_shuffled_deck[i+1],
                ref_shuffled_deck[i+2],
                ref_shuffled_deck[i+3]])
        }
        for(var i=0;i<ref_masked_deck.length;i+=4){
            maskedCardsNew.push([ref_masked_deck[i+0],
                ref_masked_deck[i+1],
                ref_masked_deck[i+2],
                ref_masked_deck[i+3]])
        }
        
        expect(JSON.stringify(maskedCardsNew)).eq(JSON.stringify(maskedCards));
        
        //Both below are coming false but should be true
        expect(SE.verify_shuffled_cards(maskedCardsNew,shuffleCardsNew,ref_proof)).eq(true)
        await TestZypherMock.shuffle(maskedCardsNew ,shuffleCardsNew ,ref_proof);
    });
});