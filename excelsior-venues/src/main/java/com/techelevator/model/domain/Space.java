package com.techelevator.model.domain;

public class Space {
	
	private long id;
	private long venueId;
	private String name;
	private boolean isAccessible;
	private int openFrom;
	private int openTo;
	private double dailyRate;
	private int maxOccupancy;

	public Space() {
		
	}

	public long getId() {
		return id;
	}

	public long getVenueId() {
		return venueId;
	}

	public String getName() {
		return name;
	}

	public boolean isAccessible() {
		return isAccessible;
	}

	public int getOpenFrom() {
		return openFrom;
	}

	public int getOpenTo() {
		return openTo;
	}

	public double getDailyRate() {
		return dailyRate;
	}

	public int getMaxOccupancy() {
		return maxOccupancy;
	}

	public void setId(long id) {
		this.id = id;
	}

	public void setVenueId(long venueId) {
		this.venueId = venueId;
	}

	public void setName(String name) {
		this.name = name;
	}

	public void setAccessible(boolean isAccessible) {
		this.isAccessible = isAccessible;
	}

	public void setOpenFrom(int openFrom) {
		this.openFrom = openFrom;
	}

	public void setOpenTo(int openTo) {
		this.openTo = openTo;
	}

	public void setDailyRate(double dailyRate) {
		this.dailyRate = dailyRate;
	}

	public void setMaxOccupancy(int maxOccupancy) {
		this.maxOccupancy = maxOccupancy;
	}
	
	
}
