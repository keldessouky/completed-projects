package com.techelevator.model.domain;

public class Reservation {
	private long reservationId;
	private long spaceId;
	private int numberOfAttendees;
	private String startDate;
	private String endDate;
	private String reservedFor;
	private int venueId;
	private String spaceName;
	private String venueName;
	private double dailyRate;
	private boolean isAccessible;
	private int numberOfDays;

	public Reservation() {
		// hint for SQL query, break it up and think creatively.
	}

	public int getVenueId() {
		return venueId;
	}

	public void setVenueId(int venueId) {
		this.venueId = venueId;
	}

	public String getSpaceName() {
		return spaceName;
	}

	public void setSpaceName(String spaceName) {
		this.spaceName = spaceName;
	}

	public String getVenueName() {
		return venueName;
	}

	public void setVenueName(String venueName) {
		this.venueName = venueName;
	}

	public long getReservationId() {
		return reservationId;
	}

	public void setReservationId(long reservationId) {
		this.reservationId = reservationId;
	}

	public long getSpaceId() {
		return spaceId;
	}

	public void setSpaceId(long spaceId) {
		this.spaceId = spaceId;
	}

	public int getNumberOfAttendees() {
		return numberOfAttendees;
	}

	public void setNumberOfAttendees(int numberOfAttendees) {
		this.numberOfAttendees = numberOfAttendees;
	}

	public String getStartDate() {
		return startDate;
	}

	public void setStartDate(String date) {
		this.startDate = date;
	}

	public String getEndDate() {
		return endDate;
	}

	public void setEndDate(String date) {
		this.endDate = date;
	}

	public String getReservedFor() {
		return reservedFor;
	}

	public void setReservedFor(String reservedFor) {
		this.reservedFor = reservedFor;
	}

	public double getDailyRate() {
		return dailyRate;
	}

	public void setDailyRate(double dailyRate) {
		this.dailyRate = dailyRate;
	}

	public boolean getIsAccessible() {
		return isAccessible;
	}

	public void setAccessible(boolean isAccessible) {
		this.isAccessible = isAccessible;
	}

	public int getNumberOfDays() {
		return numberOfDays;
	}

	public void setNumberOfDays(int numberOfDays) {
		this.numberOfDays = numberOfDays;
	}

	public double calculateTotalCost(int numberOfDays, double dailyRate) {

		double totalCost = ((double) numberOfDays) * dailyRate;

		return totalCost;
	}

}
