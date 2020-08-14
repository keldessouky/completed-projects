package com.techelevator.tenmo.models;

import java.math.BigDecimal;

public class TransferSimpleDetails {


	private Integer transfer_id;
	private String fromTo;
	private String secondParty;
	private BigDecimal amount;
	
	
	public Integer getTransfer_id() {
		return transfer_id;
	}
	public void setTransfer_id(Integer transfer_id) {
		this.transfer_id = transfer_id;
	}
	public void setFrom() {
		fromTo= "From:";
	}
	public void setTo() {
		fromTo= "To:";
	}
	public String getFromTo() {
		return fromTo;
	}
	public String getSecondParty() {
		return secondParty;
	}
	public void setSecondParty(String secondParty) {
		this.secondParty = secondParty;
	}
	public BigDecimal getAmount() {
		return amount;
	}
	public void setAmount(BigDecimal amount) {
		this.amount = amount;
	}

}


