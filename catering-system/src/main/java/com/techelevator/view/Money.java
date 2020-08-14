package com.techelevator.view;

public class Money {
	private double balance;



	public Money() {

		balance = 0;
	}

	public double amountDue() {
		double total = 0;

		return total;
	}

	public double getBalance() {
		return balance;
	}

	public void increaseBalance(double amountToDeposit) {
		if ((amountToDeposit + this.balance) <= 5000) {
			this.balance += amountToDeposit;
			String amountToDepositAsString = String.format("$%.2f", amountToDeposit);
			System.out.println("✅ You have successfully added " + amountToDepositAsString + " to your Account!");
		} else {
			System.out.println("❌ Maximum allowed balance is $5000"); // TODO write an exception in Menu
		}

	}

	public void decreaseBalance(double amountToDeduct) {

		balance -= amountToDeduct;

	}

	public boolean balanceValidityCheck(double amountToCharge) {
		if ((balance - amountToCharge) >= 0) {
			return true;
		} else {
			System.out.println("❌ Insufficient balance, please add more funds");
			return false;
		}

	}

	public String getBalanceAsString() {										//JUST RETURN BALANCE AS DOUBLE AND LET THE FRONTEND WORRY ABOUT THAT
		String balanceAsString = "$" + String.format("%.2f", this.balance);		//BACK END CODE IS FOR CALCULATION, FRONT END IS FOR MANIPULATING DISPLAY
		return balanceAsString;
	}



	public void returnChange() {
		MakeChange change = new MakeChange();
		change.makeChange(balance);
	}
}
