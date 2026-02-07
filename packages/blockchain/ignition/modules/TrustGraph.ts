import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TrustGraphModule = buildModule("TrustGraphModule", (m) => {
   const trustGraph = m.contract("TrustGraph");

   return { trustGraph };
});

export default TrustGraphModule;
