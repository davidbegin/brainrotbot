// Import the child_process module to execute commands
const { execSync } = require('child_process');

/**
 * Execute the brainrotter command with the specified input files and options
 * @param {string} input1 - First input file
 * @param {string} input2 - Second input file
 * @param {string} mode - Processing mode
 * @param {string} output - Output file name
 * @returns {void}
 */
function executeBrainrotter(input1, input2, mode, output) {
  try {
    // Construct the command
    const command = `./brainrotter ${input1} ${input2} ${mode} ${output}`;
    
    console.log(`Executing command: ${command}`);
    
    // Execute the command and capture output
    const stdout = execSync(command);
    
    // Print the output
    console.log(`Command executed successfully`);
    console.log(`Output: ${stdout.toString()}`);
  } catch (error) {
    console.error(`Error executing command: ${error.message}`);
    
    // If there was stderr output, print it
    if (error.stderr) {
      console.error(`Error details: ${error.stderr.toString()}`);
    }
    
    process.exit(1);
  }
}

// Main function to run the script
function main() {
  // Default parameters matching your example
  const input1 = 'test_data/gonz.mp4';
  const input2 = 'test_data/slime.mp4';
  const mode = 'v';
  const output = 'combined2.mp4';
  
  // Execute the brainrotter command
  executeBrainrotter(input1, input2, mode, output);
}

// Run the main function
main();
