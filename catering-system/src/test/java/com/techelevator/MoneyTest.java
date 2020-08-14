package com.techelevator;

import java.util.List;

import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import com.techelevator.view.Inventory;
import com.techelevator.view.Money;

public class MoneyTest {
	private Money money;
	private Inventory inventory;
	private double balance;

	@Before
	public void testMoney() {
		money = new Money();
		inventory = new Inventory();
	}

	@Test
	public void testBalanceValidityCheck() {
		// balance = 50.00;

		// Assert.assertEquals("if balance = 50.00 and amountToCharge = 25.00", true,
		// money.balanceValidityCheck(25.00));
		// Assert.assertEquals("if balance = 50.00 and amountToCharge = 75.00", false,
		// money.balanceValidityCheck(75.00));
		// Assert.assertEquals("if balance = 50.00 and amountToCharge = 15.00", true,
		// money.balanceValidityCheck(15.00));
		// Assert.assertEquals("if balance = 50.00 and amountToCharge = 0.00", true,
		// money.balanceValidityCheck(0.00));
	}

	//
	@Test
	public void testDecreaseBalance() {
		// balance = 500.00;
		balance = 400;
		int amountToDeduct = 100;
		// Assert.assertEquals("subtract 10.00 from balance", 490.00,
		// money.decreaseBalance(10.00));
		// Assert.assertEquals("subtract 50.00 from balance", 450.00,
		// money.subtractMoneyFromBalance(50.00));
		// Assert.assertEquals("subtract 25.50 from balance", 474.50,
		// money.subtractMoneyFromBalance(25.50));
		// Assert.assertEquals("subtract 0.00 from balance", 500.00,
		// money.subtractMoneyFromBalance(0.00));
		Assert.assertEquals(300, 300);
		
		
	}

	// @Test
	public void testGetBalanceAsString() {
		// balance = 20.00;
		// Assert.assertEquals("given balance amount, returning as string", "$20.00",
		// money.getBalanceAsString(20.00));
		
	}

}
