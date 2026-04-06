import { analyzePrescriptionImage } from './src/utils/geminiVision';

async function test() {
  try {
    const res = await analyzePrescriptionImage('./dummy.jpg');
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}

test();
