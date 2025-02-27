#![allow(dead_code)]
use owo_colors::OwoColorize;

const BAR_LENGTH: usize = 120;

fn print_bordered(agent_line: impl std::fmt::Display, output_line: impl std::fmt::Display) {
    let bar = "═".repeat(BAR_LENGTH);
    println!("\n{}", agent_line);
    println!("\n{}", output_line);
    println!("{}", bar);
}

pub fn summarizer_log(output: &str) {
    print_bordered(
        "Summarizer Agent".red().bold().underline(),
        output.red().bold(),
    );
}

pub fn comedian_log(output: &str) {
    print_bordered(
        "Comedian Agent".yellow().bold().underline(),
        output.yellow().bold(),
    );
}

pub fn prompt_writer_log(output: &str) {
    print_bordered(
        "Prompt Writer Agent".bright_blue().bold().underline(),
        output.bright_blue().bold(),
    );
}

pub fn joke_critic_log(output: &str) {
    print_bordered(
        "Joke Critic Writer Agent"
            .bright_magenta()
            .bold()
            .underline(),
        output.bright_magenta().bold(),
    );
}

pub fn system_log(output: &str) {
    println!("{}", "System Log".white().bold().underline());
    println!("\n{}", output.blue());
}
