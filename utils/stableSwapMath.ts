import axios from "axios";
import { stable1, stable1_stable2_app } from "../constants/constants.js";

const baseUrl = "https://testnet-idx.algonode.cloud"; // algonode.io

export const getNanoSwapExactForQuote = async ({ stable1Supply, stable2Supply, swapInAssetId, swapInAmount }) => {
  let swapInAmountLessFees = swapInAmount - (Math.floor(swapInAmount * 0.001) + 1);
  let swapOutAmount = 0;
  let numIter = 0;

  const { data: nanopoolData } = await axios
    .get(`${baseUrl}/v2/applications/${stable1_stable2_app}`)
    .catch(function (error) {
      throw new Error(
        error?.response?.data
          ? `error: ${error.response.status}  ${JSON.stringify(error.response.data)}`
          : error?.message
      );
    });
  const nanoState = nanopoolData?.application?.params?.["global-state"];
  const initialAmplificationFactor = nanoState.find((g) => g.key === "aWFm")?.value?.uint;
  const futureAmplificationFactor = nanoState.find((g) => g.key === "ZmFm")?.value?.uint;
  const initialAmplificationFactorTime = nanoState.find((g) => g.key === "aWF0")?.value?.uint;
  const futureAmplificationFactorTime = nanoState.find((g) => g.key === "ZmF0")?.value?.uint;

  //   const { amplificationFactor } = getAmplificationFactor({
  //     t: Math.floor(Date.now()/1000),
  //     initialAmplificationFactor,
  //     futureAmplificationFactor,
  //     initialAmplificationFactorTime,
  //     futureAmplificationFactorTime,
  //   });
  const amplificationFactor = futureAmplificationFactor;

  let asset1Delta, asset2Delta, lpDelta, extraComputeFee;
  if (swapInAssetId === stable1) {
    let [D, numIterD] = getD([stable1Supply, stable2Supply], amplificationFactor);
    let [y, numIterY] = getY(
      0,
      1,
      stable1Supply + swapInAmountLessFees,
      [stable1Supply, stable2Supply],
      D,
      amplificationFactor
    );
    swapOutAmount = stable2Supply - Number(y) - 1;
    numIter = numIterD + numIterY;

    asset1Delta = -1 * swapInAmount;
    asset2Delta = swapOutAmount;
    lpDelta = 0;
    extraComputeFee = Math.ceil(numIter / (700 / 400));
    // return new BalanceDelta(this, -1 * swapInAmount, swapOutAmount, 0, numIter);
  } else {
    let [D, numIterD] = getD([stable1Supply, stable2Supply], amplificationFactor);
    let [y, numIterY] = getY(
      1,
      0,
      stable2Supply + swapInAmountLessFees,
      [stable1Supply, stable2Supply],
      D,
      amplificationFactor
    );
    swapOutAmount = stable1Supply - y - 1;
    numIter = numIterD + numIterY;

    asset1Delta = swapOutAmount;
    asset2Delta = -1 * swapInAmount;
    lpDelta = 0;
    extraComputeFee = Math.ceil(numIter / (700 / 400));
    //return new BalanceDelta(this, swapOutAmount, -1 * swapInAmount, 0, numIter);
  }
  let priceDelta = 0;

  return { asset1Delta, asset2Delta, lpDelta, extraComputeFee, priceDelta };
};

const A_PRECISION = BigInt(1000000);

export function getD(tokenAmounts: Array<number>, amplificationFactor: number): [number, number] {
  let N_COINS = tokenAmounts.length;
  let S = BigInt(0);
  let Dprev = BigInt(0);

  for (var _x of Array.from(tokenAmounts)) {
    S += BigInt(_x);
  }
  if (S == BigInt(0)) {
    return [0, 0];
  }

  let D = S;
  let Ann = BigInt(amplificationFactor * Math.pow(N_COINS, N_COINS));

  for (var _i = 0; _i < 255; _i++) {
    var D_P = D;
    for (var _x of Array.from(tokenAmounts)) {
      D_P = (D_P * D) / (BigInt(_x) * BigInt(N_COINS));
    }
    Dprev = D;
    D =
      (((Ann * S) / A_PRECISION + D_P * BigInt(N_COINS)) * D) /
      (((Ann - A_PRECISION) * D) / A_PRECISION + BigInt(N_COINS + 1) * D_P);
    if (D > Dprev) {
      if (D - Dprev <= BigInt(1)) {
        return [Number(D), _i];
      }
    } else {
      if (Dprev - D <= BigInt(1)) {
        return [Number(D), _i];
      }
    }
  }
}

export function getY(
  i: number,
  j: number,
  x: number,
  tokenAmounts: Array<number>,
  D: number,
  amplificationFactor: number
): [number, number] {
  let N_COINS = tokenAmounts.length;
  let Ann = BigInt(amplificationFactor * Math.pow(N_COINS, N_COINS));
  let c = BigInt(D);
  let S = BigInt(0);
  let _x = BigInt(0);
  let y_prev = BigInt(0);

  for (var _i = 0; _i < N_COINS; _i++) {
    if (_i == i) {
      _x = BigInt(x);
    } else if (_i != j) {
      _x = BigInt(tokenAmounts[_i]);
    } else {
      continue;
    }
    S += _x;
    c = (c * BigInt(D)) / (BigInt(_x) * BigInt(N_COINS));
  }
  c = (c * BigInt(D) * A_PRECISION) / (Ann * BigInt(N_COINS));
  let b = S + (BigInt(D) * A_PRECISION) / Ann;
  let y = BigInt(D);
  for (var _i = 0; _i < 255; _i++) {
    y_prev = y;
    y = (y * y + c) / (BigInt(2) * y + b - BigInt(D));
    if (y > y_prev) {
      if (y - y_prev <= BigInt(1)) {
        return [Number(y), _i];
      }
    } else {
      if (y_prev - y <= BigInt(1)) {
        return [Number(y), _i];
      }
    }
  }
}

function getAmplificationFactor({
  t,
  initialAmplificationFactor,
  futureAmplificationFactor,
  initialAmplificationFactorTime,
  futureAmplificationFactorTime,
}): { amplificationFactor: number } {
  let amplificationFactor;
  if (t < futureAmplificationFactorTime) {
    return {
      amplificationFactor: Math.floor(
        initialAmplificationFactor +
          ((futureAmplificationFactor - initialAmplificationFactor) * (t - initialAmplificationFactor)) /
            (futureAmplificationFactorTime - initialAmplificationFactorTime)
      ),
    };
  }

  return { amplificationFactor };
}
