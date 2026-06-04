const has = (inputPins, ...values) => {
    return Object.values(inputPins).some((p) => values.includes(p.value));
};
const every = (inputPins, value) => {
    return Object.values(inputPins).every((p) => p.value === value);
};
const count = (inputPins, value) => {
    return Object.values(inputPins).filter((p) => p.value === value).length;
};
export const computeBUFFER = ({ inputPins }) => {
    const v = inputPins[0].value;
    if (v === "0")
        return ["0"];
    if (v === "1")
        return ["1"];
    return [v === "C" ? "C" : "X"];
};
export const computeNOT = ({ inputPins }) => {
    const v = inputPins[0].value;
    if (v === "0")
        return ["1"];
    if (v === "1")
        return ["0"];
    return [v === "C" ? "C" : "X"];
};
export const computeAND = ({ inputPins }) => {
    if (has(inputPins, "0"))
        return ["0"];
    if (has(inputPins, "C") && !has(inputPins, "Z", "X", "0"))
        return ["C"];
    if (every(inputPins, "1"))
        return ["1"];
    return ["X"];
};
export const computeOR = ({ inputPins }) => {
    if (has(inputPins, "1"))
        return ["1"];
    if (has(inputPins, "C"))
        return ["C"];
    if (every(inputPins, "0"))
        return ["0"];
    return ["X"];
};
export const computeNOR = ({ inputPins }) => {
    if (has(inputPins, "1"))
        return ["0"];
    if (has(inputPins, "C") && !has(inputPins, "Z", "X", "1"))
        return ["C"];
    if (every(inputPins, "0"))
        return ["1"];
    return ["X"];
};
export const computeNAND = ({ inputPins }) => {
    if (has(inputPins, "0"))
        return ["1"];
    if (has(inputPins, "C"))
        return ["C"];
    if (every(inputPins, "1"))
        return ["0"];
    return ["X"];
};
export const computeXOR = ({ inputPins }) => {
    if (has(inputPins, "X", "Z"))
        return ["X"];
    if (has(inputPins, "C"))
        return ["C"];
    return [count(inputPins, "1") % 2 === 1 ? "1" : "0"];
};
export const computeXNOR = (item) => {
    const [val] = computeXOR(item);
    return val === "0" ? ["1"] : val === "1" ? ["0"] : [val];
};
const SHIFT_REGISTER_8_WIDTH = 8;
const toBinaryBit = (value) => (value === "1" ? "1" : "0");
const readInputBit = (inputPins, pin) => toBinaryBit(inputPins[pin]?.value);
const readOutputBit = (outputPins, pin) => toBinaryBit(outputPins[pin]?.value);
const readShiftRegister8Runtime = (item) => {
    const options = item.options;
    return options?.shiftRegister8 ?? {};
};
const writeShiftRegister8Runtime = (item, runtime) => {
    const options = (item.options ?? (item.options = {}));
    options.shiftRegister8 = runtime;
};
const readShiftRegister8State = (item) => {
    const runtime = readShiftRegister8Runtime(item);
    if (Array.isArray(runtime.shift) && runtime.shift.length === SHIFT_REGISTER_8_WIDTH) {
        return runtime.shift.map(toBinaryBit);
    }
    return Array.from({ length: SHIFT_REGISTER_8_WIDTH }, (_, index) => readOutputBit(item.outputPins, String(index)));
};
const readParallelOutputLatch = (item) => {
    const runtime = readShiftRegister8Runtime(item);
    if (Array.isArray(runtime.parallel) && runtime.parallel.length === SHIFT_REGISTER_8_WIDTH) {
        return runtime.parallel.map(toBinaryBit);
    }
    return Array.from({ length: SHIFT_REGISTER_8_WIDTH }, (_, index) => readOutputBit(item.outputPins, String(index)));
};
export const computeSHIFT_REGISTER_8 = (item) => {
    const serialInput = readInputBit(item.inputPins, "0");
    const clock = readInputBit(item.inputPins, "1");
    const update = readInputBit(item.inputPins, "2");
    const runtime = readShiftRegister8Runtime(item);
    const prevClock = runtime.prevClock ?? clock;
    const prevUpdate = runtime.prevUpdate ?? update;
    let shiftState = readShiftRegister8State(item);
    let parallelLatch = readParallelOutputLatch(item);
    if (prevClock === "0" && clock === "1") {
        shiftState = [serialInput, ...shiftState.slice(0, SHIFT_REGISTER_8_WIDTH - 1)];
    }
    if (prevUpdate === "0" && update === "1") {
        parallelLatch = [...shiftState];
    }
    writeShiftRegister8Runtime(item, {
        shift: shiftState,
        parallel: parallelLatch,
        prevClock: clock,
        prevUpdate: update,
    });
    return [...parallelLatch, shiftState[SHIFT_REGISTER_8_WIDTH - 1]];
};
