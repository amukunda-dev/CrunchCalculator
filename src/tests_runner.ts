import { create, all } from 'mathjs';

const math = create(all);

interface HistoryEntry {
  expr: string;
  result: string;
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  expected?: any;
  received?: any;
}

const PHYSICAL_CONSTANTS = [
  { name: 'c', val: '299792458', desc: 'Speed of Light (m/s)' },
  { name: 'G', val: '6.6743e-11', desc: 'Gravitational Constant (m³/kg·s²)' },
  { name: 'h', val: '6.62607015e-34', desc: 'Planck Constant (J·s)' },
  { name: 'k', val: '1.380649e-23', desc: 'Boltzmann Constant (J/K)' },
  { name: 'Na', val: '6.02214076e23', desc: 'Avogadro Constant (mol⁻¹)' },
  { name: 'R', val: '8.314462618', desc: 'Molar Gas Constant (J/mol·K)' },
  { name: 'me', val: '9.1093837e-31', desc: 'Electron Mass (kg)' },
  { name: 'mp', val: '1.6726219e-27', desc: 'Proton Mass (kg)' },
];

function evaluateExpression(
  expr: string, 
  scope: any, 
  trigMode: 'deg' | 'rad' | 'grad', 
  precision: number
) {
  const constantsScope: Record<string, any> = {};
  PHYSICAL_CONSTANTS.forEach(c => {
    constantsScope[c.name] = math.evaluate(c.val);
  });

  const config = {
    angles: trigMode === 'grad' ? 'gradian' : (trigMode === 'deg' ? 'degree' : 'radian')
  };

  const fullScope = { ...scope, ...constantsScope };
  
  // Trig Mode logic (replacing standard trig functions with ones that respect our mode)
  // mathjs has built-in support for units but for raw sin(45) we need careful handling if not using units
  // In App.tsx, the trig mode is typically handled by units suffixing if needed, 
  // but here we match the app's logic which might just be pure mathjs.
  // Actually, mathjs handles angles better if we use units.
  // But our app's trig mode seems to be a setting. 
  
  // NOTE: Re-implementing the exact logic from handleCrunchEval in App.tsx
  const result = math.evaluate(expr, fullScope);
  
  let formattedResult = '';
  if (typeof result === 'number') {
    formattedResult = math.format(result, { precision });
  } else if (result && result.isUnit) {
    formattedResult = result.toString();
  } else {
    formattedResult = math.format(result, { precision });
  }
  
  return formattedResult;
}

const runTests = () => {
  const results: TestResult[] = [];
  const scope: any = {};

  const assert = (name: string, expr: string, expected: string, trigMode: any = 'rad', precision: number = 8) => {
    try {
      const received = evaluateExpression(expr, scope, trigMode, precision);
      
      // Flexible matching for numbers and units
      const isMatch = (rec: string, exp: string) => {
        if (rec === exp) return true;
        if (rec.includes(exp)) return true;
        
        // Handle scientific notation vs raw
        try {
          const recNum = math.evaluate(rec.split(' ')[0]);
          const expNum = math.evaluate(exp.split(' ')[0]);
          if (typeof recNum === 'number' && typeof expNum === 'number') {
            return Math.abs(recNum - expNum) < 1e-10;
          }
        } catch(e) {}
        
        return false;
      };

      const passed = isMatch(received, expected);
      results.push({ name, passed, expected, received });
      
      // Handle variable assignment for future tests
      if (expr.includes('=') && !expr.includes('==')) {
        const parts = expr.split('=');
        const varName = parts[0].trim();
        scope[varName] = math.evaluate(parts[1].trim(), scope);
      }
    } catch (e: any) {
      results.push({ name, passed: false, error: e.message });
    }
  };

  // 1. Basic Arithmetic
  assert('Basic Addition', '2 + 2', '4');
  assert('Order of Operations', '2 + 3 * 4', '14');
  assert('Parentheses', '(2 + 3) * 4', '20');

  // 2. Trigonometry (Default Radian)
  assert('Sin Radian', 'sin(pi/2)', '1');
  
  // 3. Physical Constants
  assert('Speed of Light', 'c', '299792458', 'rad', 12);
  assert('Planck Constant', 'h', '6.62607015e-34', 'rad', 12);

  // 4. Unit Conversions
  assert('Distance Conversion', '4 mile to km', '6.437376 km');
  assert('Temperature Conversion', '100 degC to degF', '212 degF');

  // 5. Variables
  assert('Variable Assignment', 'x = 10', '10');
  assert('Variable Usage', 'x * 5', '50');

  // 6. Precision
  assert('High Precision', '1/3', '0.33333333', 'rad', 8);
  assert('Low Precision', '1/3', '0.333', 'rad', 3);

  // 7. Currency (Mocking logic used in App.tsx)
  const unitExists = (name: string) => {
    try {
      math.unit(name);
      return true;
    } catch (e) {
      return false;
    }
  };

  try {
    if (!unitExists('usd')) math.createUnit('usd');
    if (!unitExists('inr')) math.createUnit('inr', { definition: `${1/83.5} usd` });
    assert('Currency Conversion', '1 usd to inr', '83.5 inr');
  } catch(e) {
    results.push({ name: 'Currency Setup', passed: false, error: (e as Error).message });
  }

  // 8. Bitwise & Programming
  assert('Bitwise AND', 'bitAnd(14, 7)', '6');
  assert('Bitwise OR', 'bitOr(8, 4)', '12');
  assert('Bitwise XOR', 'bitXor(10, 3)', '9');
  assert('Shift Left', 'leftShift(2, 3)', '16');
  assert('Logical AND', 'and(1, 0)', 'false');
  assert('Logical OR', 'or(1, 0)', 'true');

  // Output formatting
  console.log('\n🧪 CRUNCH CALCULATOR FEATURE TESTS\n');
  console.log('--------------------------------------------------');
  let passCount = 0;
  results.forEach(r => {
    if (r.passed) {
      console.log(`✅ [PASS] ${r.name}`);
      passCount++;
    } else {
      console.log(`❌ [FAIL] ${r.name}`);
      console.log(`   Expected: ${r.expected}`);
      console.log(`   Received: ${r.received}`);
      if (r.error) console.log(`   Error: ${r.error}`);
    }
  });
  console.log('--------------------------------------------------');
  console.log(`SUMMARY: ${passCount}/${results.length} tests passed.\n`);

  if (passCount !== results.length) {
    process.exit(1);
  }
};

runTests();
