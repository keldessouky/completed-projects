package com.techelevator.tenmo.model;

import java.math.BigDecimal;

public class Account {

	private Integer account_id;
	private Integer user_id;
	private BigDecimal balance;
	
	public BigDecimal getBalance() {
		return balance;
	}
	public void setBalance(BigDecimal bigDecimal) {
		this.balance = bigDecimal;
	}
	public Integer getAccount_id() {
		return account_id;
	}
	public void setAccount_id(Integer account_id) {
		this.account_id = account_id;
	}
	public Integer getUser_id() {
		return user_id;
	}
	public void setUser_id(Integer user_id) {
		this.user_id = user_id;
	}
	
	
}
