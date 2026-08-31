// Constants
const bMin = -0.1;
const bMax = 0.1;

const LINEAR = 0;
const LEAKY_RELU = 1;
const SIGMOID = 2;
const TANH = 3;

// KAI Setup Constants
// KAI Inputs(6):  [Target relative X,
//                  Target relative Z,
//                  Forward velocity, 
//                  Sideways velocity,
//                  Tank angular velocity,
//                  Turret relative angle,
//                  Reload progress]
// KAI Outputs(7): [Forward
//                  Backward,
//                  Chassis Right, 
//                  Chassis Left,
//                  Turret Right,
//                  Turret Left,
//                  Turret Shoot]

const inN = 7;
const layers = [[LEAKY_RELU, 8], [LEAKY_RELU, 8], [SIGMOID, 7]];
const weights = null;
const trainingDataSet = [];
//loss_function: Callable
//gradients_function: Callable
//evaluation_function: Callable = nmse
const errorThreshold = 0.01;
const maxGeneration = 1000;
const size_per_generation = 5;
const batchSize = 20;
const learningRate = 0.01;
const momentum = 0.0;

function randomUniform(a, b) {
    return a + Math.random() * (b - a);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

class Neuron {
    //0: Linear 1: Leaky ReLU 2: Sigmoid 3: Tanh
    constructor(ntype, wb = null, inN = null, outN = null){
        this.inputs = [];
        this.preActivation = 0;
        this.output = 0;
        this.dead = false;
        this.ntype = ntype;
        if (wb) {
            this.weight = wb[0];
            this.bias = wb[1];
        } else {
            if (inN === null || outN === null) {
                throw new Error("Not enough information was given to create Neuron");
            }
            if ([LEAKY_RELU].includes(this.ntype)) { // He Initialization
                var lim = Math.sqrt(6 / inN);
            } else if ([LINEAR, SIGMOID, TANH].includes(this.ntype)) { // Xavier Initialization
                var lim = Math.sqrt(6 / (inN + outN));
            } else {
                throw new TypeError("Neuron Type Undefined");
            }
            this.weight = Array.from(
                { length: inN },
                () => randomUniform(0 - lim, 0 + lim)
            );
            this.bias = randomUniform(bMin, bMax);
        }
        this.weightGradients = this.weight.map(() => 0);
        this.biasGradient = 0;
        this.batchSize = 0;
        this.delta = 0;
        this.weightVelocity = this.weight.map(() => 0);
        this.biasVelocity = 0;
    }
    calculate(inputs) {
        this.inputs = inputs;
        this.preActivation = this.bias;
        for (let i = 0; i < inputs.length; i++) {
            this.preActivation += inputs[i] * this.weight[i];
        }
        if (this.ntype === LINEAR) {
            this.output = this.preActivation;
        } else if (this.ntype === LEAKY_RELU) {
            if (this.preActivation > 0) {
                this.output = this.preActivation;
            } else {
                this.output = 0.01 * this.preActivation;
            }
        } else if (this.ntype === SIGMOID) {
            this.output = 1 / (1 + Math.exp(-this.preActivation));
        } else if (this.ntype === TANH) {
            this.output = Math.tanh(this.preActivation);
        }
    }
    activationDerivative() {
        if (this.ntype === LINEAR) {
            return 1;
        } else if (this.ntype === LEAKY_RELU) {
            if (this.preActivation > 0){
                return 1;
            } else {
                return 0.01;
            }
        } else if (this.ntype === SIGMOID) {
            return this.output * (1 - this.output);
        } else if (this.ntype === TANH) {
            return 1 - this.output ** 2;
        }
    }
    returnWB() {
        return [this.weight, this.bias];
    }
    updateWB(learningRate, momentum) {
        if (this.batchSize === 0) {
            return;
        }
        for (let w = 0; w < this.weight.length; w++) {
            this.weightVelocity[w] =
                (momentum * this.weightVelocity[w]) -
                learningRate * (
                    this.weightGradients[w] / this.batchSize
                );
            this.weight[w] += this.weightVelocity[w];
        }

        this.biasVelocity =
            (momentum * this.biasVelocity) -
            learningRate * (
                this.biasGradient / this.batchSize
            );
        this.bias += this.biasVelocity;

        this.weightGradients = this.weight.map(() => 0);
        this.biasGradient = 0;
        this.batchSize = 0;
    }
}

export class KAI {
    constructor(){
        this.initiateModel([
            inN,
            layers,
            weights,
            learningRate,
            momentum,
        ]);
    }
    initiateModel(storedModel) {
        let weights;
        [
            this.inN,
            this.layers,
            weights,
            this.learningRate,
            this.momentum
        ] = storedModel;
        this.model = [];
        for (let l = 0; l < this.layers.length; l++) {
            this.model.push([]);
            for (let n = 0; n < this.layers[l][1]; n++) {
                if (weights === null) {
                    if (l === 0) {
                        var inN = this.inN;
                    } else {
                        var inN = this.layers[l - 1][1];
                    }
                    if (l === this.layers.length - 1) {
                        var outN = 1;
                    } else {
                        var outN = this.layers[l + 1][1];
                    }
                    this.model[l].push(
                        new Neuron(
                            this.layers[l][0],
                            null,
                            inN,
                            outN
                        )
                    );
                } else {
                    this.model[l].push(
                        new Neuron(
                            this.layers[l][0],
                            weights[l][n]
                        )
                    );
                }
            }
        }
    }
    calculate(inputs) {
        if (inputs.length !== this.inN) {
            throw new Error(
                `Expected ${this.inN} inputs, but received ${inputs.length} inputs.`
            );
        }
        this.inputs = inputs;
        for (let l = 0; l < this.layers.length; l++) {
            this.outputs = [];
            for (let n = 0; n < this.layers[l][1]; n++) {
                this.model[l][n].calculate(this.inputs);
                this.outputs.push(this.model[l][n].output);
            }
            this.inputs = this.outputs;
        }
    }
    distributeError(errorGradients) {
        for (let l = this.layers.length - 1; l >= 0; l--) {
            for (let n = 0; n < this.layers[l][1]; n++) {
                if (l >= this.layers.length - 1) {
                    this.model[l][n].delta =
                        errorGradients[n] *
                        this.model[l][n].activationDerivative();
                } else {
                    let total = 0;
                    for (const nextNeuron of this.model[l + 1]) {
                        total += nextNeuron.delta * nextNeuron.weight[n];
                    }

                    this.model[l][n].delta = total * this.model[l][n].activationDerivative();
                }

                for (let i = 0; i < this.model[l][n].weight.length; i++) {
                    this.model[l][n].weightGradients[i] += this.model[l][n].delta * this.model[l][n].inputs[i];
                }

                this.model[l][n].biasGradient += this.model[l][n].delta;
                this.model[l][n].batchSize += 1;
            }
        }
    }

    train(trainingDataSet, batchSize, lossFunction, gradientsFunction) {
        let errors = [];
        shuffle(trainingDataSet);
        let currentSample = 0;
        for (const trainingData of trainingDataSet) {
            this.calculate(trainingData.inputs);
            errors.push(lossFunction(this.outputs, trainingData.outputs));
            this.distributeError(gradientsFunction(this.outputs, trainingData.outputs));
            currentSample += 1;
            if (currentSample === batchSize) {
                currentSample = 0;
                this.updateWB();
            }
        }
        if (currentSample !== 0) {
            this.updateWB();
        }
        return errors.reduce((a, b) => a + b, 0) / errors.length;
    }
    storeModel() {
        return [
            this.inN,
            this.layers,
            this.model.map(layers =>
                layers.map(neuron =>
                    neuron.returnWB()
                )
            ),
            this.learningRate,
            this.momentum
        ];
    }
    updateWB() {
        for (const layers of this.model) {
            for (const neuron of layers) {
                neuron.updateWB(this.learningRate, this.momentum);
            }
        }
    }
}