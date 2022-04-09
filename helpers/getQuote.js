import axios from "axios";
import {
  assetID,
  lTNano,
  metapoolLT,
  metapool_address,
  metapool_app,
  nanopool_address,
  stable1,
  stable2,
} from "../constants/constants.js";

export const fetchPoolState = async () => {
  const baseUrl = "https://testnet-idx.algonode.cloud/v2"; // algonode.io
  const { data: metapoolData } = await axios.get(`${baseUrl}/accounts/${metapool_address}`).catch(function (error) {
    throw new Error(
      error?.response?.data ? `error: ${error.response.status}  ${JSON.stringify(error.response.data)}` : error?.message
    );
  });

  const { amount: assetSupply } = metapoolData?.account?.assets?.find((array) => array["asset-id"] === assetID);
  const { amount: lTNanoSupply } = metapoolData?.account?.assets?.find((array) => array["asset-id"] === lTNano);

  const { data: metapoolAppData } = await axios.get(`${baseUrl}/applications/${metapool_app}`).catch(function (error) {
    throw new Error(
      error?.response?.data ? `error: ${error.response.status}  ${JSON.stringify(error.response.data)}` : error?.message
    );
  });

  const metapoolLTIssued = metapoolAppData?.application?.params?.["global-state"].find(
    (g) => g.key === "aXNzdWVkIE1ldGFwb29sIExU"
  )?.value?.uint;

  if (!assetSupply || !lTNanoSupply) throw new Error("Error, assets not found in the metapool");

  const { data: nanopoolData } = await axios.get(`${baseUrl}/accounts/${nanopool_address}`).catch(function (error) {
    throw new Error(
      error?.response?.data ? `error: ${error.response.status}  ${JSON.stringify(error.response.data)}` : error?.message
    );
  });

  const { amount: stable1Supply } = nanopoolData?.account?.assets?.find((array) => array["asset-id"] === stable1);
  const { amount: stable2Supply } = nanopoolData?.account?.assets?.find((array) => array["asset-id"] === stable2);

  if (!stable1Supply || !stable2Supply) throw new Error("Error, assets not found in the metapool");

  return { assetSupply, lTNanoSupply, stable1Supply, stable2Supply, metapoolLTIssued };
};

export const getMintQuote = async ({ assetID_amount, lTNano_amount }) => {
  if (!assetID_amount && !lTNano_amount) throw new Error("Error, input params needed");
  const { assetSupply, lTNanoSupply, metapoolLTIssued } = await fetchPoolState();
  let lTNano_needed, assetID_needed;
  if (assetID_amount) {
    lTNano_needed = Math.floor((assetID_amount * lTNanoSupply) / assetSupply);
    assetID_needed = Math.floor(assetID_amount);
  } else {
    assetID_needed = Math.floor((lTNano_amount * assetSupply) / lTNanoSupply);
    lTNano_needed = Math.floor(lTNano_amount);
  }
  // 	Metapool LT out = Math.min(
  // 	assetID amount * issued Metapool LT / assetID supply,
  // 	lTNano amount * issued Metapool LT / lTNano supply
  // )
  const expectedMintAmount = Math.floor(
    Math.min((assetID_needed * metapoolLTIssued) / assetSupply, (lTNano_needed * metapoolLTIssued) / lTNanoSupply)
  );
  console.log(
    `Send ${assetID_needed} asset and ${lTNano_needed} nanopool LT to receive ${expectedMintAmount} metapool LT`
  );
  return { assetID_needed, lTNano_needed, expectedMintAmount };
};

export const getBurnQuote = async (burnAmount) => {
  const { assetSupply, lTNanoSupply, metapoolLTIssued } = await fetchPoolState();
  // assetID out = assetID supply * burn amount / issued amount of Metapool LT
  // lTNano out = lTNano supply * burn amount / issued amount of Metapool LT
  const assetOut = (assetSupply * burnAmount) / metapoolLTIssued;
  const lTNanoOut = (lTNanoSupply * burnAmount) / metapoolLTIssued;
  console.log(
    `You will receive ${assetOut.toPrecision(4)} asset and ${lTNanoOut.toPrecision(
      4
    )} nanopool LT for burning ${burnAmount} metapool LT`
  );
  return { assetOut, lTNanoOut };
};

export const getSwapQuote = async ({ asset, assetAmount }) => {
  const { assetSupply, lTNanoSupply } = await fetchPoolState();
  //  amount_out = (asset_in_amount * 9975 * asset_out_supply) / ((asset_in_supply * 10000) + (asset_in_amount * 9975))
  let amount_out
  if (asset === assetID) {
    amount_out = Number(
      (BigInt(assetAmount) * BigInt(9975) * BigInt(lTNanoSupply)) /
        (BigInt(assetSupply) * BigInt(10000) + BigInt(assetAmount) * BigInt(9975))
    );
    console.log(`Send ${assetAmount} asset, you will receive ${amount_out} nanopool LT`);
    return { amountOut: amount_out, assetOut: lTNano };
  }
  if (asset === lTNano) {
    amount_out = Number(
      (BigInt(assetAmount) * BigInt(9975) * BigInt(assetSupply)) /
        (BigInt(lTNanoSupply) * BigInt(10000) + BigInt(assetAmount) * BigInt(9975))
    );
    console.log(`Send ${assetAmount} nanopool LT, you will receive ${amount_out} asset`);
    return { amountOut: amount_out, assetOut: assetID };
  }
  throw new Error("Error, input params invalid");
};
