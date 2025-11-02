import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedPeerReview = await deploy("PeerReview", {
    from: deployer,
    log: true,
  });

  console.log(`PeerReview contract: `, deployedPeerReview.address);
};
export default func;
func.id = "deploy_peerReview"; // id required to prevent reexecution
func.tags = ["PeerReview"];

